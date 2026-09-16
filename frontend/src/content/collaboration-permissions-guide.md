# Collaboration permissions and group-study behaviour

Mabaso AI Collaboration Rooms use the same protected room data on desktop and mobile. The layout changes with screen size, but membership, messages, materials, board items and permissions do not become separate mobile copies.

## Room roles

The room owner creates the room and manages its membership and answer-visibility setting. An authorised room manager can perform the management actions returned by the backend. A regular member can read and contribute to the room but cannot remove another student's protected content. Someone who is not a member cannot open a private room by changing the room address or guessing its identifier.

The member list shows the owner and current members. The **Members** button opens this list. The **Invite** control accepts account email addresses, while discovery invitations use an opaque public profile identifier so the discovered student's email address is not exposed. The **Room settings** button contains member management and test-answer visibility. The **Leave room** button is available to regular members and requires confirmation.

## Private and shared answers

The **Private** or **Private answers** setting keeps each student's test answers separate. The **Shared test** or **Shared answers** setting allows comparison through the room. Changing this setting does not publish the room, its chat or its materials. Only authorised room management can change the setting.

## Messages, materials and board permissions

Room members can use the chat composer and send button to contribute messages. The server verifies membership before storing or returning any message. The mobile composer remains above the fixed room navigation so sending remains accessible on small screens.

Members can press **Share material** or the mobile centre **+** button to choose from their own saved Mabaso AI history. Selecting a history row creates a room-scoped material reference and opens it in the current room. The original account material remains private and unchanged. The material owner or an authorised manager may remove the room reference after confirmation.

Members can use **Add to Board** to post notes, important reminders, quotes, tasks and announcements. **Post** validates the content and saves it to the room. **Upload** validates images before adding them to the board. A board item or image may be removed only by its creator or an authorised manager.

## Profile privacy and discovery

The **Create profile** button opens an anchored editor containing only collaboration-profile information. Saving verifies the stored profile before displaying it as active. **Discoverable by academic interests**, **Show institution** and **Allow collaboration requests** are independent privacy controls.

Discovery ranks useful academic information such as shared subjects, the same course and topics a student can help with. It does not publish email addresses or precise location. The **Invite** button in a result is enabled only when the current student manages an open room and the discovered profile permits requests.

## Navigation behaviour

On mobile, **Rooms** always returns to the room list. **Chat** and **Board** require an open room. The centre **+** opens saved-material sharing. **More** exposes Create Room, Share Existing Material, Add to Board and Upload board photo, while **Cancel** restores the previous section. Chat, Materials and Board room tabs are not displayed on the Rooms list.

On desktop, the sidebar room controls, category filters, material library, board and chat use the same backend data. **All Materials**, **Study Guides**, **Notes**, **PowerPoints**, **Mind Maps**, **Podcasts**, **Images** and **Videos** filter the room library; they do not create fake content or reveal another room's materials.

Every write action displays either a success confirmation or an understandable error inside Collaboration. Buttons are disabled when required context is missing, and destructive actions require confirmation where the result cannot be immediately undone.

