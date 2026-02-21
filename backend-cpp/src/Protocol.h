#pragma once
#include <cstdint>
#include <array>
#include <cstdio>
#include <string_view>
#include <optional>
#include <nlohmann/json.hpp>

namespace protocol {

struct StatePayload {
    float rpm = 0.0f;
    float angleRad = 0.0f;
    float stressPa = 0.0f;
    float stressFactor = 0.0f;
    float pistonForceN = 0.0f;
    float rodForceN = 0.0f;
    float tangentialForceN = 0.0f;
    float torqueNm = 0.0f;
    float sideThrustN = 0.0f;
    uint64_t timestampMs = 0;
};

struct SetRpmPayload {
    float rpmTarget = 0.0f;
};

struct ReplayPayload {
    std::string mode;  // "live", "freeze", "seek"
    uint64_t tMs = 0;
};

// ── Zero-copy-ish serialization into a pre-allocated buffer ──
// Returns the number of chars written (excluding null terminator).
inline std::size_t serializeState(const StatePayload& s, std::array<char, 512>& buf) {
    int n = std::snprintf(
        buf.data(), buf.size(),
        R"({"type":"state","payload":{)"
        R"("rpm":%.2f,"angle_rad":%.6f,"stress_pa":%.2f,"stress_factor":%.6f,)"
        R"("piston_force_n":%.2f,"rod_force_n":%.2f,"tangential_force_n":%.2f,)"
        R"("torque_nm":%.4f,"side_thrust_n":%.2f,)"
        R"("timestamp_ms":%llu}})",
        static_cast<double>(s.rpm),
        static_cast<double>(s.angleRad),
        static_cast<double>(s.stressPa),
        static_cast<double>(s.stressFactor),
        static_cast<double>(s.pistonForceN),
        static_cast<double>(s.rodForceN),
        static_cast<double>(s.tangentialForceN),
        static_cast<double>(s.torqueNm),
        static_cast<double>(s.sideThrustN),
        static_cast<unsigned long long>(s.timestampMs)
    );
    return (n > 0 && static_cast<std::size_t>(n) < buf.size())
        ? static_cast<std::size_t>(n)
        : 0;
}

inline std::string_view stateView(const std::array<char, 512>& buf, std::size_t len) {
    return { buf.data(), len };
}

// ── Parsing incoming client messages ──
enum class ClientMsgType { SetRpm, Replay, Unknown };

struct ClientMessage {
    ClientMsgType type = ClientMsgType::Unknown;
    SetRpmPayload setRpm;
    ReplayPayload replay;
};

inline std::optional<ClientMessage> parseClientMessage(std::string_view raw) {
    try {
        auto j = nlohmann::json::parse(raw);
        ClientMessage msg;
        auto typeStr = j.at("type").get<std::string>();

        if (typeStr == "set_rpm") {
            msg.type = ClientMsgType::SetRpm;
            msg.setRpm.rpmTarget = j.at("payload").at("rpm_target").get<float>();
            return msg;
        }
        if (typeStr == "replay") {
            msg.type = ClientMsgType::Replay;
            msg.replay.mode = j.at("payload").at("mode").get<std::string>();
            if (j["payload"].contains("t_ms")) {
                msg.replay.tMs = j["payload"]["t_ms"].get<uint64_t>();
            }
            return msg;
        }
        return std::nullopt;
    } catch (...) {
        return std::nullopt;
    }
}

} // namespace protocol
