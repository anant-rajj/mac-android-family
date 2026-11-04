// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "FamilyDaemon",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "family-daemon", targets: ["FamilyDaemon"])
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "FamilyDaemon",
            dependencies: [],
            path: "Sources/FamilyDaemon"
        )
    ]
)
