import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
const siteConfigSource = await readFile(new URL("../src/sitePageConfig.js", import.meta.url), "utf8");
const siteShellSource = await readFile(new URL("../src/EnterpriseSiteShell.jsx", import.meta.url), "utf8");
const publicGuideSource = await readFile(new URL("../src/content/collaboration-guide.md", import.meta.url), "utf8");

assert.doesNotMatch(appSource, /\/>\\n\\n\s*\{isProfileEditorOpen/, "Collaboration must not render literal newline text.");
assert.doesNotMatch(appSource, /collaboration-upload-card/, "Collaboration must not display an upload allowance card.");
assert.match(appSource, /currentPage === "collaboration" \|\| isUpgradeModalOpen/, "The global mobile nav must not overlap Collaboration navigation.");
assert.match(appSource, /currentPage !== "collaboration" \? \(/, "The outer profile strip must not duplicate the Collaboration account menu.");
assert.match(appSource, /renderCompactProfileMenu\(\{ displayName: collaborationDisplayName \}\)/, "Collaboration must use the real account menu with logout.");
assert.match(appSource, /activeRoom && collaborationMobileView !== "rooms" \? <div className="collaboration-mobile-room-tabs"/, "Room tabs must be hidden on the Rooms list.");
assert.match(appSource, /if \(view === "more"\) \{\s*setIsCollaborationActionSheetOpen\(true\);\s*return;/, "Closing More must retain the previous mobile room panel.");
assert.match(appSource, /if \(view !== "rooms" && !activeRoom\)/, "Chat and Board must return users to Rooms when no room is open.");
assert.match(appSource, /aria-label="Share saved material">＋<\/button>/, "The mobile create action must open saved-material sharing.");
assert.match(appSource, /authFetch\(`\/collaboration\/rooms\/\$\{roomId\}\/messages`/, "Chat send must call the authenticated room-message endpoint.");
assert.match(appSource, /const optimisticMessage = \{/, "Room chat must render messages optimistically instead of waiting for a full room reload.");
assert.match(appSource, /event\.nativeEvent\?\.isComposing/, "Desktop Enter-to-send must preserve IME composition.");
assert.match(appSource, /authFetch\(`\/collaboration\/rooms\/\$\{roomId\}\/board-items`/, "Board post must call the authenticated board endpoint.");
assert.match(appSource, /setSelectedCollaborationBoardItem\(item\)/, "Board cards must open a clear reading view.");
assert.match(appSource, /removeMemberFromActiveRoom\(member\)/, "Manage Members must expose the authorized removal action.");
assert.match(appSource, /authFetch\("\/collaboration\/presence", \{ method: "POST" \}\)/, "Collaboration must publish authenticated presence heartbeats.");
assert.match(appSource, /profile\.is_online \? <i className="collaboration-presence-dot"/, "Discover must mark genuinely online students.");
assert.match(appSource, /authFetch\(`\/collaboration\/rooms\/\$\{activeRoomId\}\/material-items`/, "Saved material sharing must call the room-material endpoint.");
assert.match(appSource, /if \(!data\.profile\) throw new Error\("The server did not return the saved profile\."\)/, "Profile saving must use the persisted profile returned by the save endpoint without a second slow request.");
assert.match(appSource, /disabled=\{isSavingCollaborationProfile\}/, "Profile fields must be locked while the save request is running.");
assert.match(appSource, /Show my account email in Discover/, "Profile privacy must include explicit email sharing consent.");
assert.match(appSource, /Show my personal number in Discover/, "Profile privacy must include explicit phone sharing consent.");
assert.match(appSource, /\/voice-notes`/, "Room chat must send recorded voice notes through the authenticated backend.");
assert.match(appSource, /\+ Add photo/, "The room Images tool must provide a working photo upload action.");
assert.match(appSource, /\+ Add video/, "The room Videos tool must provide a working video upload action.");
assert.match(appSource, /inviteDiscoveredProfileToRoom\(profile\)/, "Discovery results must offer privacy-safe room invitations.");
assert.match(appSource, /role=\{error \? "alert" : "status"\}/, "Collaboration API failures must be visible in the page.");
assert.match(cssSource, /\.collaboration-chat-panel\.is-mobile-active \.collaboration-chat-composer \{ position:fixed;/, "Mobile room chat composer must stay above the bottom navigation.");
assert.match(cssSource, /\.collaboration-board-reader \{/, "Expanded board items need a responsive reader surface.");
assert.match(cssSource, /\.study-chat-page-composer \.ai-chat-mode-full-label \{ display:none !important;/, "The mobile model picker must use the compact non-overlapping label.");
assert.match(siteConfigSource, /route: "\/collaboration\/shared-study-rooms"[\s\S]*?access: "public"/, "The Collaboration guide must be readable without signing in.");
assert.match(siteConfigSource, /markdown: collaborationGuideMarkdown/, "The public Collaboration route must render the complete guide.");
assert.match(siteShellSource, /page\.route\.startsWith\("\/collaboration\/"\)/, "Collaboration public pages must use the prose-only layout.");
for (const requiredSection of ["Rooms and the room list", "Shared materials and the category buttons", "Collaboration Board", "Room Chat", "Create Profile and student discovery", "More actions", "Privacy and access rules"]) {
  assert.match(publicGuideSource, new RegExp(requiredSection), `The public guide must explain ${requiredSection}.`);
}

console.log("Collaboration control wiring checks passed.");
