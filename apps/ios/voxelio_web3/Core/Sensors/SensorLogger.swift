import CoreLocation
import CoreMotion
import Foundation

/// Records IMU + barometer + GPS samples while a scan is in progress.
/// The output JSON is one of the inputs to the proof bundle hash.
final class SensorLogger: NSObject, CLLocationManagerDelegate {

    struct Record: Codable {
        let startedAt: TimeInterval
        let stoppedAt: TimeInterval
        let nonce: String?
        let motion: [MotionSample]
        let altitude: [AltitudeSample]
        let location: [LocationSample]
    }

    struct MotionSample: Codable {
        let t: TimeInterval
        let ax: Double; let ay: Double; let az: Double
        let rx: Double; let ry: Double; let rz: Double
    }

    struct AltitudeSample: Codable {
        let t: TimeInterval
        let pressureKPa: Double
        let relativeAltitude: Double
    }

    struct LocationSample: Codable {
        let t: TimeInterval
        let lat: Double; let lon: Double
        let hAcc: Double; let alt: Double; let vAcc: Double
    }

    private let motion = CMMotionManager()
    private let altimeter = CMAltimeter()
    private let locationManager = CLLocationManager()

    private var motionSamples: [MotionSample] = []
    private var altitudeSamples: [AltitudeSample] = []
    private var locationSamples: [LocationSample] = []
    private var startedAt: TimeInterval = 0
    private var nonce: String?

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }

    func start(nonce: String?) {
        self.nonce = nonce
        startedAt = Date().timeIntervalSince1970
        motionSamples.removeAll(keepingCapacity: true)
        altitudeSamples.removeAll(keepingCapacity: true)
        locationSamples.removeAll(keepingCapacity: true)

        // CoreMotion callbacks fire on the queue we hand it. Using
        // OperationQueue.main keeps the appends on the main actor where
        // motionSamples / altitudeSamples live — passing a background
        // queue here causes EXC_BAD_ACCESS the moment we mutate from
        // off-actor under SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor.
        if motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 1.0 / 30.0
            motion.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
                guard let self, let data else { return }
                self.motionSamples.append(MotionSample(
                    t: data.timestamp,
                    ax: data.userAcceleration.x, ay: data.userAcceleration.y, az: data.userAcceleration.z,
                    rx: data.rotationRate.x, ry: data.rotationRate.y, rz: data.rotationRate.z
                ))
            }
        }

        if CMAltimeter.isRelativeAltitudeAvailable() {
            altimeter.startRelativeAltitudeUpdates(to: .main) { [weak self] data, _ in
                guard let self, let data else { return }
                self.altitudeSamples.append(AltitudeSample(
                    t: data.timestamp,
                    pressureKPa: data.pressure.doubleValue,
                    relativeAltitude: data.relativeAltitude.doubleValue
                ))
            }
        }

        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
    }

    @discardableResult
    func stop() -> Record {
        motion.stopDeviceMotionUpdates()
        altimeter.stopRelativeAltitudeUpdates()
        locationManager.stopUpdatingLocation()

        return Record(
            startedAt: startedAt,
            stoppedAt: Date().timeIntervalSince1970,
            nonce: nonce,
            motion: motionSamples,
            altitude: altitudeSamples,
            location: locationSamples
        )
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for loc in locations {
            let sample = LocationSample(
                t: loc.timestamp.timeIntervalSince1970,
                lat: loc.coordinate.latitude,
                lon: loc.coordinate.longitude,
                hAcc: loc.horizontalAccuracy,
                alt: loc.altitude,
                vAcc: loc.verticalAccuracy
            )
            Task { @MainActor in self.locationSamples.append(sample) }
        }
    }
}
