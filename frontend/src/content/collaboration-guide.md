# How Mabaso AI Collaboration Rooms work

Collaboration Rooms are private, account-based study spaces where students can work with the same room, materials, board and conversation on desktop or mobile. You may read this guide without signing in, but opening a room, seeing its members or content, creating a profile, sharing a material or sending a message requires an authenticated Mabaso AI account.

## Opening and leaving the Collaboration area

The back arrow in the top-left corner returns to the main Mabaso AI capture area. The search button opens the student-discovery section. The profile button opens the normal account menu, where you can create or edit your profile, change language and log out. Collaboration does not add a second account button.

On desktop, the room list, shared materials, board and chat can appear together. On a phone, Mabaso AI shows one main section at a time so the controls remain readable. The fixed bottom navigation is always the main way to move between Rooms, Chat, Board and More.

## Rooms and the room list

The **Rooms** button opens your room list even when no room or material is currently open. **Create New Room** expands the room form. Enter a room title, optionally add invitation email addresses, choose the room's test-answer setting and press **Create Room**. The new room opens immediately after the server confirms it was created.

**Private** means each member's test answers remain private. **Shared test** allows members to compare the answers that are deliberately shared through the room. These controls do not make the room or a student's private workspace public.

**My Rooms** returns to the rooms that belong to or include the signed-in student. Selecting any room name opens that room and loads its current messages, materials, board items and member list. The highlighted room is the room currently being viewed.

## The room header

The room header shows the room name, membership count and whether you are the owner or a member. The member-count button opens the room's member list. **Room settings** opens access and answer-visibility controls. Owners can manage members and change answer visibility. A regular member can use **Leave room**, which asks for confirmation before removing that membership. Owners are not shown a misleading Leave button because ownership must be handled safely first.

**Invite** moves an owner to the invitation control. Enter one or more student email addresses and press **Invite** to add those accounts to the room. The invitation is processed by the protected backend; the address is not published in student discovery. **Follow shared view** controls whether the workspace follows the room's selected study-tool context.

## Mobile room navigation

The bottom **Rooms** button always returns to the room list. **Chat** opens the selected room's conversation. The centre **+** button opens the signed-in student's saved Mabaso AI history so an existing study material can be shared without downloading and uploading it again. **Board** opens the selected room's collaboration board. **More** opens secondary creation and sharing actions without abandoning the section that was already open.

If Chat, Board or the centre + button is pressed before a room is selected, Mabaso AI returns to Rooms and explains that a room must be opened first. The Chat, Materials and Board tabs appear only after a room is open; they are intentionally absent from the mobile Rooms list.

## Shared materials and the category buttons

**All Materials** shows everything shared in the room. **Study Guides**, **Notes**, **PowerPoints**, **Mind Maps**, **Podcasts**, **Images** and **Videos** filter the existing room library by that material type. A category button does not generate new content and does not expose material from another room. **More** opens additional room actions instead of squeezing more permanent controls onto small screens.

**Share material** opens your complete saved Mabaso AI history. Pressing anywhere on a saved-history row selects that item, loads its full account-owned content, creates a protected room material and opens the shared preview in the current collaboration room. The original private history item remains in your account. Study guides, formulas, worked examples, presentations, podcasts, mind maps, images and practice questions retain the preview data that is available in the saved item.

Pressing a material row opens its preview. The preview identifies the title, type and contributor, then shows the supported study content. The close button returns to the room. The three-dot material action is shown only to the material owner or an authorised room manager. Removing a material from the room does not delete the owner's original Mabaso AI history item, and confirmation is required before removal.

## Collaboration Board

The board holds information that the group wants to keep visible separately from chat. **Add to Board** opens the board composer. Choose **Group note**, **Important**, **Key quote**, **Group task** or **Announcement**, enter the relevant title or message and press **Post**. A task can contain one checklist item per line and can be posted even when the title is empty, provided that the checklist contains real content.

**Upload** opens the image picker and adds validated study images to the current room's board. Uploaded board images remain attached to that room. **Remove** is shown only to the student who uploaded the image or an authorised room manager.

Each board item displays its type, title, content and checklist where relevant. The item action is available only to the creator or an authorised manager. Deleting an item requires confirmation and removes that board record from the room.

## Room Chat

The chat area displays saved room messages in time order and identifies the signed-in student's own messages as **You**. Type into **Type a message** and press the arrow send button. On mobile, the composer stays fixed directly above the Collaboration bottom navigation so the keyboard and navigation do not hide it. Pressing Enter sends a message; Shift+Enter creates a new line.

Messages are written through the authenticated room-message endpoint and are reloaded with the room. Only room members can fetch or send room messages. If a message cannot be sent, the reason is displayed inside the Collaboration page instead of leaving the button looking unresponsive.

## Create Profile and student discovery

**Create profile** opens a small panel beside the button rather than replacing or blurring the page. A profile can include a display name, institution, course, year or grade, subjects, topics the student can help with, topics where help is needed and a short academic biography. After **Save profile** succeeds, Mabaso AI reads the profile back from the server and displays **Profile saved and active** together with the saved display name and academic summary.

**Discoverable by academic interests** controls whether the profile can appear in discovery. **Show institution** controls whether the institution is visible. **Allow collaboration requests** controls whether another authorised room manager may invite that profile. Email addresses and precise locations are never shown in discovery.

The discovery search accepts student names, courses, subjects, modules and help topics such as MATLAB or Communication Systems. Press **Search** or Enter to run it. Results explain useful academic matches, such as a shared subject, the same course or a topic the student can help with. A room owner or moderator can press **Invite** on an eligible result. Mabaso AI sends only the student's opaque public profile identifier to the protected invitation endpoint; public search results do not contain the student's email address.

## More actions

The mobile **More** button opens secondary actions. **Create Room** returns to the room form. **Share Existing Material** opens saved-history sharing. **Add to Board** opens the board composer. **Upload board photo** opens the validated image picker. **Cancel** closes the menu and returns to the section that was open before More was pressed.

## Status messages and errors

Successful actions such as creating a room, sending a message, sharing a material, saving a profile or posting to the board display confirmation inside the Collaboration page. Authentication, permission, network and validation failures display an error in the same area. A failed write is not silently treated as successful.

## Privacy and access rules

Room content is protected by both authentication and room membership. Knowing a room identifier is not enough to read its chat, materials or board. Owners and moderators receive management permissions; regular members cannot delete another student's material or board item. Student discovery uses academic relevance and voluntary profile fields. It does not reveal email addresses, private workspaces, private materials or precise location.

The Collaboration interface never changes a private saved workspace into a public link automatically. Sharing to a room creates a room-scoped material record for authorised members. Public sharing, where available elsewhere in Mabaso AI, is a separate explicit action with its own protected share token.

