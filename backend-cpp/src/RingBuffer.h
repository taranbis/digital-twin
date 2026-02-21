#pragma once
#include <array>
#include <cstddef>
#include <algorithm>

template <typename T, std::size_t Capacity>
class RingBuffer {
public:
    void push(const T& item) {
        mData[mHead] = item;
        mHead = (mHead + 1) % Capacity;
        if (mSize < Capacity) ++mSize;
    }

    [[nodiscard]] std::size_t size() const { return mSize; }
    [[nodiscard]] static constexpr std::size_t capacity() { return Capacity; }
    [[nodiscard]] bool empty() const { return mSize == 0; }

    [[nodiscard]] const T& at(std::size_t index) const {
        std::size_t realIdx = (mHead + Capacity - mSize + index) % Capacity;
        return mData[realIdx];
    }

    [[nodiscard]] const T& latest() const {
        return mData[(mHead + Capacity - 1) % Capacity];
    }

    [[nodiscard]] const T& oldest() const {
        return at(0);
    }

    template <typename Fn>
    void forEach(Fn&& fn) const {
        for (std::size_t i = 0; i < mSize; ++i) {
            fn(at(i), i);
        }
    }

    void clear() {
        mHead = 0;
        mSize = 0;
    }

private:
    std::array<T, Capacity> mData{};
    std::size_t mHead = 0;
    std::size_t mSize = 0;
};
