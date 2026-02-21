#include <iostream>
#include <string>
#include <string_view>
#include <memory>
#include <set>
#include <deque>
#include <mutex>
#include <thread>
#include <chrono>
#include <atomic>
#include <csignal>
#include <array>

#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <boost/beast/websocket.hpp>

#include "PhysicsEngine.h"
#include "Protocol.h"

namespace beast = boost::beast;
namespace ws    = beast::websocket;
namespace net   = boost::asio;
using tcp       = net::ip::tcp;

static std::atomic<bool> gRunning{true};

#ifdef _WIN32
static BOOL WINAPI consoleHandler(DWORD) {
    gRunning.store(false, std::memory_order_relaxed);
    return TRUE;
}
#else
static void signalHandler(int) {
    gRunning.store(false, std::memory_order_relaxed);
}
#endif

// ── Triple-buffer pool for zero-copy-ish broadcast ──
// Pre-allocate N fixed buffers; rotate on each tick. Shared ownership via
// shared_ptr ensures the buffer outlives all async writes before reuse.
struct BroadcastSlot {
    std::array<char, 512> data{};
    std::size_t len = 0;
};

static constexpr std::size_t kPoolSize = 4;

class BroadcastPool {
public:
    std::shared_ptr<BroadcastSlot> next() {
        auto& slot = mSlots[mIdx];
        mIdx = (mIdx + 1) % kPoolSize;
        return slot;
    }

    BroadcastPool() {
        for (auto& s : mSlots) s = std::make_shared<BroadcastSlot>();
    }

private:
    std::array<std::shared_ptr<BroadcastSlot>, kPoolSize> mSlots;
    std::size_t mIdx = 0;
};

// ── Per-client WebSocket session ──
class WsSession : public std::enable_shared_from_this<WsSession> {
public:
    WsSession(tcp::socket socket, PhysicsEngine& engine,
              std::set<std::shared_ptr<WsSession>>& sessions, std::mutex& sessionsMtx)
        : mWs(std::move(socket))
        , mEngine(engine)
        , mSessions(sessions)
        , mSessionsMtx(sessionsMtx)
    {
        mWs.binary(false);
        mWs.text(true);
    }

    void run(beast::http::request<beast::http::string_body> req) {
        mWs.async_accept(req,
            beast::bind_front_handler(&WsSession::onAccept, shared_from_this()));
    }

    // Zero-copy broadcast: slot is shared across all clients for this tick
    void sendShared(std::shared_ptr<BroadcastSlot> slot) {
        net::post(mWs.get_executor(), [self = shared_from_this(), s = std::move(slot)]() {
            self->mPendingSlots.push_back(std::move(s));
            if (self->mPendingSlots.size() == 1) {
                self->doWriteSlot();
            }
        });
    }

private:
    void onAccept(beast::error_code ec) {
        if (ec) return destroy();
        {
            std::lock_guard lk(mSessionsMtx);
            mSessions.insert(shared_from_this());
        }
        doRead();
    }

    void doRead() {
        mWs.async_read(mReadBuf,
            beast::bind_front_handler(&WsSession::onRead, shared_from_this()));
    }

    void onRead(beast::error_code ec, std::size_t) {
        if (ec) return destroy();

        auto raw = beast::buffers_to_string(mReadBuf.data());
        mReadBuf.consume(mReadBuf.size());

        auto parsed = protocol::parseClientMessage(raw);
        if (parsed) {
            switch (parsed->type) {
            case protocol::ClientMsgType::SetRpm:
                mEngine.setRpmTarget(parsed->setRpm.rpmTarget);
                break;
            case protocol::ClientMsgType::Replay:
                break;
            default:
                break;
            }
        }
        doRead();
    }

    void doWriteSlot() {
        if (mPendingSlots.empty()) return;
        auto& slot = mPendingSlots.front();
        mWs.async_write(
            net::buffer(slot->data.data(), slot->len),
            beast::bind_front_handler(&WsSession::onWriteSlot, shared_from_this()));
    }

    void onWriteSlot(beast::error_code ec, std::size_t) {
        if (ec) return destroy();
        mPendingSlots.pop_front();
        if (!mPendingSlots.empty()) doWriteSlot();
    }

    void destroy() {
        beast::error_code ec;
        mWs.close(ws::close_code::normal, ec);
        std::lock_guard lk(mSessionsMtx);
        mSessions.erase(shared_from_this());
    }

    ws::stream<beast::tcp_stream> mWs;
    beast::flat_buffer mReadBuf;
    std::deque<std::shared_ptr<BroadcastSlot>> mPendingSlots;
    PhysicsEngine& mEngine;
    std::set<std::shared_ptr<WsSession>>& mSessions;
    std::mutex& mSessionsMtx;
};

// ── HTTP session: upgrades to WS or serves /health ──
class HttpSession : public std::enable_shared_from_this<HttpSession> {
public:
    HttpSession(tcp::socket socket, PhysicsEngine& engine,
                std::set<std::shared_ptr<WsSession>>& sessions, std::mutex& sessionsMtx)
        : mStream(std::move(socket))
        , mEngine(engine)
        , mSessions(sessions)
        , mSessionsMtx(sessionsMtx)
    {}

    void run() { doRead(); }

private:
    void doRead() {
        mReq = {};
        beast::http::async_read(mStream, mBuf, mReq,
            beast::bind_front_handler(&HttpSession::onRead, shared_from_this()));
    }

    void onRead(beast::error_code ec, std::size_t) {
        if (ec) return;

        if (beast::websocket::is_upgrade(mReq)) {
            auto session = std::make_shared<WsSession>(
                mStream.release_socket(), mEngine, mSessions, mSessionsMtx);
            session->run(std::move(mReq));
            return;
        }

        beast::http::response<beast::http::string_body> res{
            beast::http::status::ok, mReq.version()};
        res.set(beast::http::field::server, "DigitalTwin/1.0");
        res.set(beast::http::field::content_type, "text/plain");
        res.set(beast::http::field::access_control_allow_origin, "*");
        res.body() = "ok";
        res.prepare_payload();

        auto sp = std::make_shared<decltype(res)>(std::move(res));
        beast::http::async_write(mStream, *sp,
            [self = shared_from_this(), sp](beast::error_code, std::size_t) {});
    }

    beast::tcp_stream mStream;
    beast::flat_buffer mBuf;
    beast::http::request<beast::http::string_body> mReq;
    PhysicsEngine& mEngine;
    std::set<std::shared_ptr<WsSession>>& mSessions;
    std::mutex& mSessionsMtx;
};

// ── Listener ──
class Listener : public std::enable_shared_from_this<Listener> {
public:
    Listener(net::io_context& ioc, tcp::endpoint ep,
             PhysicsEngine& engine,
             std::set<std::shared_ptr<WsSession>>& sessions, std::mutex& sessionsMtx)
        : mIoc(ioc)
        , mAcceptor(net::make_strand(ioc))
        , mEngine(engine)
        , mSessions(sessions)
        , mSessionsMtx(sessionsMtx)
    {
        beast::error_code ec;
        mAcceptor.open(ep.protocol(), ec);
        mAcceptor.set_option(net::socket_base::reuse_address(true), ec);
        mAcceptor.bind(ep, ec);
        mAcceptor.listen(net::socket_base::max_listen_connections, ec);
    }

    void run() { doAccept(); }

private:
    void doAccept() {
        mAcceptor.async_accept(
            net::make_strand(mIoc),
            beast::bind_front_handler(&Listener::onAccept, shared_from_this()));
    }

    void onAccept(beast::error_code ec, tcp::socket socket) {
        if (!ec) {
            std::make_shared<HttpSession>(
                std::move(socket), mEngine, mSessions, mSessionsMtx)->run();
        }
        doAccept();
    }

    net::io_context& mIoc;
    tcp::acceptor mAcceptor;
    PhysicsEngine& mEngine;
    std::set<std::shared_ptr<WsSession>>& mSessions;
    std::mutex& mSessionsMtx;
};

int main() {
    std::cout << "=== Digital Twin Backend ===\n";

#ifdef _WIN32
    SetConsoleCtrlHandler(consoleHandler, TRUE);
#else
    std::signal(SIGINT, signalHandler);
    std::signal(SIGTERM, signalHandler);
#endif

    constexpr unsigned short kPort = 3001;
    constexpr int kBroadcastIntervalMs = 10;

    PhysicsEngine engine;
    std::set<std::shared_ptr<WsSession>> sessions;
    std::mutex sessionsMtx;

    net::io_context ioc{1};

    auto listener = std::make_shared<Listener>(
        ioc, tcp::endpoint{net::ip::make_address("0.0.0.0"), kPort},
        engine, sessions, sessionsMtx);
    listener->run();

    std::jthread ioThread([&ioc](std::stop_token) {
        ioc.run();
    });

    std::cout << "WebSocket server listening on ws://localhost:" << kPort << "\n";
    std::cout << "Health check: http://localhost:" << kPort << "/health\n";

    BroadcastPool pool;
    auto lastLogTime = std::chrono::steady_clock::now();
    unsigned broadcastCount = 0;

    while (gRunning.load(std::memory_order_relaxed)) {
        auto tickStart = std::chrono::steady_clock::now();

        engine.step();

        // Serialize once into the next pool slot; shared_ptr keeps it alive
        // until all async writes complete — no per-client heap allocation.
        auto slot = pool.next();
        auto state = engine.snapshot();
        slot->len = protocol::serializeState(state, slot->data);

        if (slot->len > 0) {
            std::lock_guard lk(sessionsMtx);
            for (auto& s : sessions) {
                s->sendShared(slot);
            }
            ++broadcastCount;
        }

        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - lastLogTime).count();
        if (elapsed >= 2) {
            std::size_t clientCount;
            {
                std::lock_guard lk(sessionsMtx);
                clientCount = sessions.size();
            }
            double rate = static_cast<double>(broadcastCount) / static_cast<double>(elapsed);
            std::cout << "[stats] clients=" << clientCount
                      << " broadcast_rate=" << rate << " Hz"
                      << " rpm=" << state.rpm << "\n";
            broadcastCount = 0;
            lastLogTime = now;
        }

        auto tickEnd = std::chrono::steady_clock::now();
        auto tickDuration = std::chrono::duration_cast<std::chrono::microseconds>(tickEnd - tickStart);
        auto sleepTime = std::chrono::microseconds(kBroadcastIntervalMs * 1000) - tickDuration;
        if (sleepTime.count() > 0) {
            std::this_thread::sleep_for(sleepTime);
        }
    }

    std::cout << "\nShutting down...\n";
    ioc.stop();
    ioThread.join();
    std::cout << "Clean exit.\n";
    return 0;
}
