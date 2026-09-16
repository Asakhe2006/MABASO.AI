import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../src/index.css", import.meta.url), "utf8");

assert.doesNotMatch(appSource, /\/>\\n\\n\s*\{isProfileEditorOpen/, "Collaboration must not render literal newline text.");
assert.match(appSource, /currentPage === "collaboration" \|\| isUpgradeModalOpen/, "The global mobile nav must not overlap Collaboration navigation.");
assert.match(appSource, /currentPage !== "collaboration" \? \(/, "The outer profile strip must not duplicate the Collaboration account menu.");
assert.match(appSource, /renderCompactProfileMenu\(\{ displayName: collaborationDisplayName \}\)/, "Collaboration must use the real account menu with logout.");
assert.match(appSource, /activeRoom && collaborationMobileView !== "rooms" \? <div className="collaboration-mobile-room-tabs"/, "Room tabs must be hidden on the Rooms list.");
assert.match(appSource, /if \(view === "more"\) \{\s*setIsCollaborationActionSheetOpen\(true\);\s*return;/, "Closing More must retain the previous mobile room panel.");
assert.match(appSource, /if \(view !== "rooms" && !activeRoom\)/, "Chat and Board must return users to Rooms when no room is open.");
assert.match(appSource, /aria-label="Share saved material">＋<\/button>/, "The mobile create action must open saved-material sharing.");
assert.match(appSource, /authFetch\(`\/collaboration\/rooms\/\$\{roomId\}\/messages`/, "Chat send must call the authenticated room-message endpoint.");
assert.match(appSource, /authFetch\(`\/collaboration\/rooms\/\$\{roomId\}\/board-items`/, "Board post must call the authenticated board endpoint.");
assert.match(appSource, /authFetch\(`\/collaboration\/rooms\/\$\{activeRoomId\}\/material-items`/, "Saved material sharing must call the room-material endpoint.");
assert.match(appSource, /verificationResponse = await authFetch\("\/collaboration\/profile\/me"/, "Profile saving must verify persisted server state.");
assert.match(appSource, /inviteDiscoveredProfileToRoom\(profile\)/, "Discovery results must offer privacy-safe room invitations.");
assert.match(appSource, /role=\{error \? "alert" : "status"\}/, "Collaboration API failures must be visible in the page.");
assert.match(cssSource, /\.collaboration-chat-panel\.is-mobile-active \.collaboration-chat-composer \{ position:fixed;/, "Mobile room chat composer must stay above the bottom navigation.");
assert.match(cssSource, /\.study-chat-page-composer \.ai-chat-mode-full-label \{ display:none !important;/, "The mobile model picker must use the compact non-overlapping label.");

console.log("Collaboration control wiring checks passed.");
