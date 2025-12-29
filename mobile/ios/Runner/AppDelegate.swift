import Flutter
import UIKit
import GoogleMaps
import FirebaseCore

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Initialize Firebase BEFORE Flutter plugins load
    // This prevents the "No app has been configured yet" warning
    FirebaseApp.configure()
    
    // Initialize Google Maps with API key
    GMSServices.provideAPIKey("AIzaSyAT5FF3xVciBazvfh2CkMVZQQ3986EkyhA")
    
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
