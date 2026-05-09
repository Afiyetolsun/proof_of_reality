import SwiftUI

/// Top-level container. Two peer surfaces — Home (capture mode picker)
/// and Scans (proof history) — accessed via the standard iOS bottom
/// tab bar. Each tab owns its own NavigationStack so back-stack state
/// is preserved per-tab when the user switches between them, matching
/// Apple's HIG for hierarchical-within-tabs navigation.
struct MainTabView: View {
    @State private var selectedTab: Tab = .home

    enum Tab: Hashable {
        case home
        case scans
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                RootView()
            }
            .tabItem {
                Label("Home", systemImage: "house.fill")
            }
            .tag(Tab.home)

            NavigationStack {
                ProofHistoryView()
            }
            .tabItem {
                Label("Scans", systemImage: "square.stack.3d.up.fill")
            }
            .tag(Tab.scans)
        }
    }
}

#Preview { MainTabView() }
