#pragma once
#include <atomic>
#include <cstdint>
#include <cmath>
#include <algorithm>
#include <thread>
#include "Protocol.h"
#include "RingBuffer.h"

class PhysicsEngine {
public:
    // Rotating assembly (centrifugal stress model)
    static constexpr float kMass        = 2.5f;
    static constexpr float kRadius      = 0.08f;
    static constexpr float kArea        = 0.0004f;

    // Crank-slider mechanism
    static constexpr float kCrankThrow    = 0.04f;    // 40 mm throw → 80 mm stroke
    static constexpr float kConRodLength  = 0.128f;   // 128 mm connecting rod
    static constexpr float kPistonMass    = 0.4f;     // 400 g piston + wrist pin
    static constexpr float kLambda        = kCrankThrow / kConRodLength;

    static constexpr float kTau         = 0.35f;
    static constexpr float kRpmMin      = 0.0f;
    static constexpr float kRpmMax      = 8000.0f;
    static constexpr float kDefaultRpm  = 1200.0f;
    static constexpr float kTwoPi       = 2.0f * 3.14159265358979323846f;
    static constexpr float kDt          = 0.01f; // 100 Hz
    static constexpr std::size_t kHistorySize = 1000; // 10s at 100Hz

    PhysicsEngine();

    void setRpmTarget(float target);
    [[nodiscard]] float rpmTarget() const;

    void step();

    [[nodiscard]] protocol::StatePayload snapshot() const;

    using History = RingBuffer<protocol::StatePayload, kHistorySize>;
    [[nodiscard]] const History& history() const { return mHistory; }

    static float computeStressMaxPa();

private:
    float mRpm              = 0.0f;
    float mRpmTarget        = kDefaultRpm;
    float mAngleRad         = 0.0f;
    float mOmegaRadS        = 0.0f;
    float mStressPa         = 0.0f;
    float mStressFactor     = 0.0f;
    float mStressMaxPa;

    // Crank-slider forces (Newtons / Nm)
    float mPistonForceN     = 0.0f;
    float mRodForceN        = 0.0f;
    float mTangentialForceN = 0.0f;
    float mTorqueNm         = 0.0f;
    float mSideThrustN      = 0.0f;

    History mHistory;

    std::atomic<protocol::StatePayload> mLatestSnapshot{};
    std::atomic<float> mAtomicRpmTarget{kDefaultRpm};
};
