#include "PhysicsEngine.h"
#include <chrono>

PhysicsEngine::PhysicsEngine()
    : mStressMaxPa(computeStressMaxPa())
{
    mAtomicRpmTarget.store(kDefaultRpm, std::memory_order_relaxed);
}

float PhysicsEngine::computeStressMaxPa() {
    float omegaMax = kRpmMax * kTwoPi / 60.0f;
    float forceMax = kMass * kRadius * omegaMax * omegaMax;
    return forceMax / kArea;
}

void PhysicsEngine::setRpmTarget(float target) {
    target = std::clamp(target, kRpmMin, kRpmMax);
    mAtomicRpmTarget.store(target, std::memory_order_relaxed);
}

float PhysicsEngine::rpmTarget() const {
    return mAtomicRpmTarget.load(std::memory_order_relaxed);
}

void PhysicsEngine::step() {
    float target = mAtomicRpmTarget.load(std::memory_order_relaxed);
    mRpmTarget = target;

    // Smooth RPM response: rpm += (target - rpm) * (1 - exp(-dt / tau))
    float alpha = 1.0f - std::exp(-kDt / kTau);
    mRpm += (mRpmTarget - mRpm) * alpha;
    mRpm = std::clamp(mRpm, kRpmMin, kRpmMax);

    mOmegaRadS = mRpm * kTwoPi / 60.0f;

    mAngleRad += mOmegaRadS * kDt;
    if (mAngleRad >= kTwoPi) mAngleRad -= kTwoPi;
    if (mAngleRad < 0.0f)    mAngleRad += kTwoPi;

    float force = kMass * kRadius * mOmegaRadS * mOmegaRadS;
    mStressPa = force / kArea;
    mStressFactor = std::clamp(mStressPa / mStressMaxPa, 0.0f, 1.0f);

    // Crank-slider dynamics (inertial forces only — no gas pressure)
    // Piston acceleration (2nd-order approximation):
    //   a = -R·ω²·(cos θ + λ·cos 2θ)
    float omega2 = mOmegaRadS * mOmegaRadS;
    float cosTheta = std::cos(mAngleRad);
    float sinTheta = std::sin(mAngleRad);
    float pistonAccel = -kCrankThrow * omega2
                        * (cosTheta + kLambda * std::cos(2.0f * mAngleRad));
    mPistonForceN = kPistonMass * pistonAccel;

    // Connecting rod angle from bore axis: φ = asin(λ·sin θ)
    float sinPhi = kLambda * sinTheta;
    float phi = std::asin(std::clamp(sinPhi, -1.0f, 1.0f));
    float cosPhi = std::cos(phi);

    // Rod force (along rod axis): F_rod = F_piston / cos φ
    mRodForceN = (cosPhi > 1e-4f) ? mPistonForceN / cosPhi : 0.0f;

    // Tangential force at crank pin (perpendicular to crank arm, drives rotation):
    //   F_t = F_rod · sin(θ + φ)
    float thetaPlusPhi = mAngleRad + phi;
    mTangentialForceN = mRodForceN * std::sin(thetaPlusPhi);

    // Instantaneous torque: T = F_t · R
    mTorqueNm = mTangentialForceN * kCrankThrow;

    // Side thrust on cylinder wall: F_side = F_piston · tan φ
    mSideThrustN = (cosPhi > 1e-4f) ? mPistonForceN * sinPhi / cosPhi : 0.0f;

    auto now = std::chrono::steady_clock::now().time_since_epoch();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(now).count();

    protocol::StatePayload state{};
    state.rpm = mRpm;
    state.angleRad = mAngleRad;
    state.stressPa = mStressPa;
    state.stressFactor = mStressFactor;
    state.pistonForceN = mPistonForceN;
    state.rodForceN = mRodForceN;
    state.tangentialForceN = mTangentialForceN;
    state.torqueNm = mTorqueNm;
    state.sideThrustN = mSideThrustN;
    state.timestampMs = static_cast<uint64_t>(ms);

    mHistory.push(state);
    mLatestSnapshot.store(state, std::memory_order_release);
}

protocol::StatePayload PhysicsEngine::snapshot() const {
    return mLatestSnapshot.load(std::memory_order_acquire);
}
