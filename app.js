let users = JSON.parse(localStorage.getItem("users")) || [];
users = users.map(u => ({
  user: u.user,
  pass: u.pass,
  avatar: u.avatar || null,
  friends: Array.isArray(u.friends) ? u.friends : [],
  bio: u.bio || "This is my bio.",
  status: u.status || "Ready to connect.",
  active: typeof u.active === "boolean" ? u.active : false
}));
let posts = JSON.parse(localStorage.getItem("posts")) || [];
let publicMessages = JSON.parse(localStorage.getItem("publicMessages")) || [];
let messages = JSON.parse(localStorage.getItem("messages")) || [];
let currentUser = localStorage.getItem("currentUser") || "";

const firebaseConfig = {
  apiKey: "AIzaSyANtBAgurbdYePV2WCKp3aMyttLQnK52K8",
  authDomain: "prom-26b4b.firebaseapp.com",
  projectId: "prom-26b4b",
  storageBucket: "prom-26b4b.firebasestorage.app",
  messagingSenderId: "206064316497",
  appId: "1:206064316497:web:c577820d707da7af0e8870",
  measurementId: "G-JVRMPCV8JR"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

console.log("🔥 Firebase Connected");

// =========================
// SAFE LOCAL STORAGE
// =========================

function safeLoad(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

// Socket.IO client (only available on pages that include the socket.io script)
let socket;
if (typeof io !== 'undefined') {
  socket = io();
  if (currentUser) socket.emit('join', currentUser);
  socket.on('private_message', msg => {
    messages.push(msg);
    saveMessages();
    renderMessages();
    if (currentConversation === msg.from || currentConversation === msg.to) renderConversation(currentConversation);
  });
  socket.on('public_message', msg => {
    publicMessages.unshift(msg);
    savePublicMessages();
    renderPublicMessages();
  });
}

async function uploadSongFile(file) {
  if (!file) return null;
  try {
    const fd = new FormData();
    fd.append('song', file);
    const res = await fetch('/api/upload/song', { method: 'POST', body: fd });
    const j = await res.json();
    if (j && j.ok) return { path: j.path, name: j.name };
  } catch (e) {
    console.error('uploadSongFile error', e);
  }
  return null;
}

function saveUsers() {
  localStorage.setItem("users", JSON.stringify(users));
}

function savePosts() {
  localStorage.setItem("posts", JSON.stringify(posts));
}

function savePublicMessages() {
  localStorage.setItem("publicMessages", JSON.stringify(publicMessages));
}

function saveMessages() {
  localStorage.setItem("messages", JSON.stringify(messages));
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function findUser(username) {
  return users.find(user => user.user === username);
}

function getCurrentUser() {
  return findUser(currentUser);
}

function updateUser(updatedUser) {
  const index = users.findIndex(user => user.user === updatedUser.user);
  if (index !== -1) {
    users[index] = updatedUser;
    saveUsers();
  }
}

function setCurrentUserActive(active) {
  const current = getCurrentUser();
  if (!current) return;
  current.active = active;
  updateUser(current);
}

function updateStatus(newStatus) {
  const current = getCurrentUser();
  if (!current) return;
  current.status = newStatus;
  updateUser(current);
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderPosts() {
  const postsDiv = document.getElementById("posts");
  if (!postsDiv) return;
  postsDiv.innerHTML = "";
  if (posts.length === 0) {
    postsDiv.innerHTML = "<p class=\"muted-text\">No public updates yet. Share a romantic moment.</p>";
    return;
  }
  posts.forEach(post => {
    const card = document.createElement("div");
    card.className = "post";
    const author = document.createElement("strong");
    author.textContent = `${post.user} · ${formatDate(post.timestamp)}`;
    card.appendChild(author);
    if (post.content) {
      const content = document.createElement("p");
      content.textContent = post.content;
      card.appendChild(content);
    }
    if (post.image) {
      const image = document.createElement("img");
      image.className = "post-image";
      image.src = post.image;
      image.alt = `Post image by ${post.user}`;
      card.appendChild(image);
    }
    if (post.songData || post.songUrl) {
      const songBlock = document.createElement("div");
      songBlock.className = "song-share";
      songBlock.innerHTML = renderSongMarkup(post);
      card.appendChild(songBlock);
    }
    const actions = document.createElement("div");
    actions.className = "post-actions";
    if (post.image) {
      const downloadLink = document.createElement("a");
      downloadLink.href = post.image;
      downloadLink.download = "photo.png";
      downloadLink.className = "download-link";
      downloadLink.textContent = "Download photo";
      actions.appendChild(downloadLink);
    }
    if (post.user === currentUser) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-link";
      deleteButton.dataset.postId = post.id;
      deleteButton.textContent = "Delete post";
      actions.appendChild(deleteButton);
    }
    if (actions.children.length) {
      card.appendChild(actions);
    }
    postsDiv.appendChild(card);
  });
}

function renderPublicMessages() {
  const publicDiv = document.getElementById("publicMessages");
  if (!publicDiv) return;
  publicDiv.innerHTML = "";
  if (publicMessages.length === 0) {
    publicDiv.innerHTML = "<p class=\"muted-text\">No public messages yet. Post a song or photo with your feelings.</p>";
    return;
  }
  publicMessages.forEach(message => {
    const card = document.createElement("div");
    card.className = "public-message";
    card.dataset.messageId = message.id;
    card.dataset.messageType = "public";
    const header = document.createElement("strong");
    header.textContent = `${message.user} · ${formatDate(message.timestamp)}`;
    card.appendChild(header);
    if (message.content) {
      const content = document.createElement("p");
      content.textContent = message.content;
      card.appendChild(content);
    }
    if (message.image) {
      const image = document.createElement("img");
      image.className = "public-image";
      image.src = message.image;
      image.alt = `Shared image by ${message.user}`;
      card.appendChild(image);
      const actions = document.createElement("div");
      actions.className = "public-actions";
      const downloadLink = document.createElement("a");
      downloadLink.href = message.image;
      downloadLink.download = "shared-photo.png";
      downloadLink.className = "download-link";
      downloadLink.textContent = "Download photo";
      actions.appendChild(downloadLink);
      if (message.user === currentUser) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-link delete-public";
        deleteButton.dataset.messageId = message.id;
        deleteButton.textContent = "Delete";
        actions.appendChild(deleteButton);
      }
      card.appendChild(actions);
    }
    if (message.songData || message.songUrl) {
      const songBlock = document.createElement("div");
      songBlock.className = "song-share";
      songBlock.innerHTML = renderSongMarkup(message);
      card.appendChild(songBlock);
    }
    if (Array.isArray(message.reactions) && message.reactions.length) {
      const reactionRow = document.createElement("div");
      reactionRow.className = "public-reactions";
      message.reactions.forEach(reaction => {
        const pill = document.createElement("span");
        pill.className = "reaction-pill";
        pill.textContent = `${reaction.emoji} ${reaction.count}`;
        reactionRow.appendChild(pill);
      });
      card.appendChild(reactionRow);
    }
    publicDiv.appendChild(card);
  });
}

function renderFriendSuggestions(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const current = getCurrentUser();
  if (!current) {
    container.innerHTML = "";
    return;
  }
  const suggestions = users.filter(user => user.user !== current.user && !current.friends.includes(user.user));
  if (suggestions.length === 0) {
    container.innerHTML = "<p class=\"muted-text\">No new matches right now.</p>";
    return;
  }
  container.innerHTML = suggestions.map(user => {
    return `
      <div class="member-card">
        <div class="member-meta">
          <h4>${user.user}</h4>
          <small>${user.bio}</small>
        </div>
        <button type="button" class="secondary-button add-friend" data-username="${user.user}">Match</button>
      </div>
    `;
  }).join("");
}

function getConversationThreads() {
  const current = getCurrentUser();
  if (!current) return [];
  const threadMap = {};
  messages.forEach(message => {
    if (message.from === current.user || message.to === current.user) {
      const other = message.from === current.user ? message.to : message.from;
      if (!threadMap[other]) threadMap[other] = [];
      threadMap[other].push(message);
    }
  });
  return Object.entries(threadMap).map(([other, threadMessages]) => ({
    user: other,
    messages: threadMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    last: threadMessages.reduce((latest, message) => new Date(message.timestamp) > new Date(latest.timestamp) ? message : latest, threadMessages[0])
  })).sort((a, b) => new Date(b.last.timestamp) - new Date(a.last.timestamp));
}

function renderMessages() {
  const messageList = document.getElementById("messageList");
  if (!messageList) return;
  const current = getCurrentUser();
  if (!current) {
    messageList.innerHTML = "";
    return;
  }
  const threads = getConversationThreads();
  if (threads.length === 0) {
    messageList.innerHTML = "<p class=\"muted-text\">No private conversations yet. Start a new message.</p>";
    return;
  }
  messageList.innerHTML = threads.map(thread => {
    const preview = thread.last.content ? thread.last.content.slice(0, 48) : "Sent media";
    return `
      <div class="message-thread" data-username="${thread.user}">
        <strong>${thread.user}</strong>
        <p class="muted-text">${preview}</p>
      </div>
    `;
  }).join("");
}

function renderMessageRecipients() {
  const select = document.getElementById("messageRecipient");
  if (!select) return;
  const current = getCurrentUser();
  if (!current) return;
  const recipients = users.filter(user => current.friends.includes(user.user));
  if (recipients.length === 0) {
    select.innerHTML = `<option value="">Match a friend to send private messages</option>`;
    return;
  }
  select.innerHTML = recipients.map(user => `<option value="${user.user}">${user.user}</option>`).join("");
}

function renderConversation(partner) {
  const panel = document.getElementById("conversationPanel");
  const title = document.getElementById("conversationTitle");
  const messagesContainer = document.getElementById("conversationMessages");
  const replyInput = document.getElementById("conversationReply");
  const current = getCurrentUser();
  if (!panel || !title || !messagesContainer || !replyInput || !current) return;
  if (!partner) {
    panel.classList.add("hidden");
    return;
  }
  currentConversation = partner;
  panel.classList.remove("hidden");
  title.textContent = `Conversation with ${partner}`;
  const thread = messages.filter(message =>
    (message.from === current.user && message.to === partner) ||
    (message.from === partner && message.to === current.user)
  ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (thread.length === 0) {
    messagesContainer.innerHTML = "<p class=\"muted-text\">No messages yet. Send the first note.</p>";
  } else {
    messagesContainer.innerHTML = thread.map(message => {
      const typeClass = message.from === current.user ? "message-sent" : "message-received";
      const reactionsMarkup = renderReactionsMarkup(message.reactions);
      const downloadMarkup = message.image ? `<a href=\"${message.image}\" download class=\"download-link\">Download photo</a>` : "";
      const deleteMarkup = message.from === current.user ? `<button type=\"button\" class=\"delete-link delete-message\" data-message-id=\"${message.id}\">Delete</button>` : "";
      const songMarkup = (message.songData || message.songUrl) ? `<div class=\"song-share\">${renderSongMarkup(message)}</div>` : "";
      return `<div class=\"message-bubble ${typeClass}\" data-message-id=\"${message.id}\" data-message-type=\"private\"><small>${message.from}</small><p>${message.content}</p>${songMarkup}${reactionsMarkup}<div class=\"message-actions\">${downloadMarkup}${deleteMarkup}</div></div>`;
    }).join("");
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  replyInput.value = "";
}

function openConversation(username) {
  currentConversation = username;
  renderConversation(username);
}

function renderReactionsMarkup(reactions) {
  if (!Array.isArray(reactions) || reactions.length === 0) return "";
  return `<div class=\"reaction-row\">${reactions.map(reaction => `<span class=\"reaction-pill\">${reaction.emoji} ${reaction.count}</span>`).join("")}</div>`;
}

function renderSongMarkup(item) {
  if (!item) return "";
  const source = item.songData || item.songUrl || item.songPath || "";
  if (!source) return "";
  const fileName = item.songName || (typeof item.songUrl === "string" ? item.songUrl.split("/").pop() : (typeof item.songPath === 'string' ? item.songPath.split('/').pop() : 'song.mp3'));
  const audioMarkup = `<audio controls src=\"${source}\"></audio>`;
  if (/^data:audio\//i.test(source) || /^\/uploads\//.test(source) || /^https?:\/\//.test(source)) {
    return `${audioMarkup}<a href=\"${source}\" download=\"${fileName}\" class=\"download-link\">Download ${fileName}</a>`;
  }
  return `${audioMarkup}<a href=\"${source}\" target=\"_blank\" rel=\"noreferrer\" class=\"open-link\">Play shared song</a>`;
}

function renderFriendList() {
  const friendList = document.getElementById("friendList");
  const friendCount = document.getElementById("friendCount");
  const current = getCurrentUser();
  if (!friendList || !friendCount || !current) return;
  if (current.friends.length === 0) {
    friendList.innerHTML = "<p class=\"muted-text\">You haven\'t matched with anyone yet. Find a romantic connection.</p>";
  } else {
    friendList.innerHTML = current.friends.map(friendName => {
      const friendData = findUser(friendName);
      const activeText = friendData?.active ? "Active" : "Not active";
      const activeClass = friendData?.active ? "status-pill active" : "status-pill";
      return `
        <div class="member-card">
          <div class="member-meta">
            <h4>${friendName}</h4>
            <small>${friendData ? friendData.bio : "Match"}</small>
            <span class="${activeClass}">${activeText}</span>
          </div>
          <div>
            <button type="button" class="secondary-button message-user" data-username="${friendName}">Message</button>
            <button type="button" class="secondary-button remove-friend" data-username="${friendName}">Unmatch</button>
          </div>
        </div>
      `;
    }).join("");
  }
  friendCount.textContent = `${current.friends.length} friend${current.friends.length === 1 ? "" : "s"}`;
}

function renderProfile() {
  const profileName = document.getElementById("profileName");
  const profileAvatar = document.querySelector(".avatar");
  const profileBio = document.getElementById("bio");
  const followerCount = document.getElementById("followerCount");
  const followingCount = document.getElementById("followingCount");
  const postCount = document.getElementById("postCount");
  const statusText = document.getElementById("statusText");
  const statusState = document.getElementById("statusState");
  const statusIndicator = document.getElementById("statusIndicator");
  const current = getCurrentUser();
  if (!current) return;
  if (profileName) profileName.textContent = current.user;
  if (profileBio) profileBio.textContent = current.bio;
  if (profileAvatar) profileAvatar.src = current.avatar || "avatar.png";
  if (followerCount) {
    const followers = users.filter(user => Array.isArray(user.friends) && user.friends.includes(current.user)).length;
    followerCount.textContent = followers;
  }
  if (followingCount) {
    followingCount.textContent = current.friends.length;
  }
  if (postCount) {
    postCount.textContent = posts.filter(post => post.user === current.user).length;
  }
  if (statusText) statusText.textContent = current.status;
  if (statusState) statusState.textContent = current.active ? "Active now" : "Not active";
  if (statusIndicator) {
    statusIndicator.classList.toggle("active", current.active);
  }
  renderFriendList();
  renderFriendSuggestions("friendSuggestions");
}

function addFriend(friendName) {
  const current = getCurrentUser();
  const friend = findUser(friendName);
  if (!current || !friend || current.friends.includes(friendName)) return;
  current.friends.push(friendName);
  friend.friends = Array.isArray(friend.friends) ? friend.friends : [];
  if (!friend.friends.includes(current.user)) {
    friend.friends.push(current.user);
  }
  updateUser(current);
  updateUser(friend);
  renderFriendList();
  renderFriendSuggestions("friendSuggestions");
  renderMessageRecipients();
}

function removeFriend(friendName) {
  const current = getCurrentUser();
  const friend = findUser(friendName);
  if (!current || !friend) return;
  current.friends = current.friends.filter(name => name !== friendName);
  friend.friends = Array.isArray(friend.friends) ? friend.friends.filter(name => name !== current.user) : [];
  updateUser(current);
  updateUser(friend);
  renderFriendList();
  renderFriendSuggestions("friendSuggestions");
  renderMessageRecipients();
}

function sendMessage(to, content, imageUrl = null, songUrl = "", songName = "") {
  const current = getCurrentUser();
  if (!current || !to || !content.trim()) return;
  const msg = {
    id: createMessageId(),
    from: current.user,
    to,
    content: content.trim(),
    image: imageUrl,
    songUrl,
    songName,
    reactions: [],
    timestamp: new Date().toISOString()
  };
  messages.push(msg);
  saveMessages();
  renderMessages();
  if (currentConversation === to) renderConversation(to);
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('private_message', { ...msg, songPath: songUrl });
  }
}

function sendPublicMessage(content, imageUrl = null, songUrl = "", songName = "") {
  const current = getCurrentUser();
  if (!current || !content.trim()) return;
  const msg = {
    id: createMessageId(),
    user: current.user,
    content: content.trim(),
    image: imageUrl,
    songUrl,
    songName,
    reactions: [],
    timestamp: new Date().toISOString()
  };
  publicMessages.unshift(msg);
  savePublicMessages();
  renderPublicMessages();
  if (typeof socket !== 'undefined' && socket) {
    socket.emit('public_message', msg);
  }
}

function addReaction(messageId, type, emoji) {
  const targetList = type === "public" ? publicMessages : messages;
  const message = targetList.find(item => item.id === messageId);
  if (!message) return;
  message.reactions = message.reactions || [];
  const existing = message.reactions.find(reaction => reaction.emoji === emoji);
  if (existing) {
    existing.count += 1;
  } else {
    message.reactions.push({ emoji, count: 1 });
  }
  saveMessages();
  savePublicMessages();
  renderPublicMessages();
  if (type === "private" && currentConversation) {
    renderConversation(currentConversation);
  }
}

function deletePost(postId) {
  posts = posts.filter(post => post.id !== postId);
  savePosts();
  renderPosts();
}

function deleteMessage(messageId) {
  messages = messages.filter(message => message.id !== messageId);
  saveMessages();
  renderMessages();
  renderConversation(currentConversation);
}

function deletePublicMessage(messageId) {
  publicMessages = publicMessages.filter(message => message.id !== messageId);
  savePublicMessages();
  renderPublicMessages();
}

function activateLongPress(bubble, messageId, messageType) {
  const picker = document.getElementById("reactionPicker");
  if (!picker) return;
  picker.dataset.messageId = messageId;
  picker.dataset.messageType = messageType;
  picker.classList.remove("hidden");
}

function hideReactionPicker() {
  const picker = document.getElementById("reactionPicker");
  if (!picker) return;
  picker.classList.add("hidden");
  delete picker.dataset.messageId;
  delete picker.dataset.messageType;
}

let currentConversation = null;
let longPressTimer;

document.body.addEventListener("mousedown", event => {
  const bubble = event.target.closest(".message-bubble, .public-message");
  if (!bubble) return;
  longPressTimer = window.setTimeout(() => {
    const messageId = bubble.dataset.messageId;
    const type = bubble.dataset.messageType || "public";
    if (messageId) {
      activateLongPress(bubble, messageId, type);
    }
  }, 600);
});

document.body.addEventListener("mouseup", () => {
  clearTimeout(longPressTimer);
});

document.body.addEventListener("touchstart", event => {
  const bubble = event.target.closest(".message-bubble, .public-message");
  if (!bubble) return;
  longPressTimer = window.setTimeout(() => {
    const messageId = bubble.dataset.messageId;
    const type = bubble.dataset.messageType || "public";
    if (messageId) {
      activateLongPress(bubble, messageId, type);
    }
  }, 600);
});

document.body.addEventListener("touchend", () => {
  clearTimeout(longPressTimer);
});

const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", event => {
    event.preventDefault();
    const user = document.getElementById("newUser").value.trim();
    const pass = document.getElementById("newPass").value.trim();
    if (!user || !pass) {
      alert("Please provide both username and password.");
      return;
    }
    if (findUser(user)) {
      alert("That username is already taken.");
      return;
    }
    users.push({ user, pass, avatar: null, friends: [], bio: "This is my bio.", status: "Ready to connect.", active: false });
    saveUsers();
    alert("Account created! Please log in.");
    window.location.href = "index.html";
  });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", event => {
    event.preventDefault();
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value.trim();
    const found = findUser(user);
    if (found && found.pass === pass) {
      currentUser = user;
      localStorage.setItem("currentUser", user);
      found.active = true;
      updateUser(found);
      window.location.href = "feed.html";
    } else {
      alert("Invalid credentials.");
    }
  });
}

const postForm = document.getElementById("postForm");
if (postForm) {
  postForm.addEventListener("submit", async event => {
    event.preventDefault();
    const content = document.getElementById("postContent").value.trim();
    const imageInput = document.getElementById("postImage");
        let songData = null;
        let songName = "";
        let songUrl = "";
        const songFile = postSongFile?.files?.[0];
        if (songFile) {
          try {
            const uploaded = await uploadSongFile(songFile);
            if (uploaded) {
              songUrl = uploaded.path;
              songName = uploaded.name;
            } else {
              // fallback to data URL if upload failed
              songData = await readFileAsDataURL(songFile);
              songName = songFile.name;
            }
          } catch (error) {
            alert("Unable to upload song.");
          }
        }
    let imageData = null;
    const imageFile = imageInput?.files?.[0];
    if (imageFile) {
      try {
        imageData = await readFileAsDataURL(imageFile);
      } catch (error) {
        alert("Unable to upload image.");
      }
    }
    if (!content && !imageData && !songUrl && !songData) return;
    posts.unshift({ id: createMessageId(), user: currentUser, content, image: imageData, songUrl: songUrl || songData, songName, timestamp: new Date().toISOString() });
    savePosts();
    document.getElementById("postContent").value = "";
    if (imageInput) imageInput.value = "";
    if (postSongFile) postSongFile.value = "";
    renderPosts();
  });
}

const newMessageButton = document.getElementById("newMessageButton");
const messageComposerPanel = document.getElementById("messageComposerPanel");
const sendMessageButton = document.getElementById("sendMessageButton");
const messageContent = document.getElementById("messageContent");
const messageRecipient = document.getElementById("messageRecipient");
const messageImageInput = document.getElementById("messageImage");
const messageSongFile = document.getElementById("messageSongFile");
const conversationReply = document.getElementById("conversationReply");
const replySongFile = document.getElementById("replySongFile");
const replyButton = document.getElementById("replyButton");
const publicForm = document.getElementById("publicForm");
const publicContent = document.getElementById("publicContent");
const publicImageInput = document.getElementById("publicImage");
const publicSongFile = document.getElementById("publicSongFile");
const postSongFile = document.getElementById("postSongFile");

if (newMessageButton && messageComposerPanel) {
  newMessageButton.addEventListener("click", () => {
    messageComposerPanel.classList.toggle("hidden");
    renderMessageRecipients();
  });
}

if (sendMessageButton && messageRecipient && messageContent) {
  sendMessageButton.addEventListener("click", async () => {
    const recipient = messageRecipient.value;
    const content = messageContent.value;
    let songUrl = "";
    let songName = "";
    const songFile = messageSongFile?.files?.[0];
    if (songFile) {
      const uploaded = await uploadSongFile(songFile);
      if (uploaded) {
        songUrl = uploaded.path;
        songName = uploaded.name;
      } else {
        songUrl = await readFileAsDataURL(songFile);
        songName = songFile.name;
      }
    }
    let imageData = null;
    const file = messageImageInput?.files?.[0];
    if (file) {
      imageData = await readFileAsDataURL(file);
    }
    if (!recipient || !content.trim()) return;
    sendMessage(recipient, content, imageData, songUrl, songName);
    messageContent.value = "";
    if (messageImageInput) messageImageInput.value = "";
    if (messageSongFile) messageSongFile.value = "";
    messageComposerPanel.classList.add("hidden");
    openConversation(recipient);
  });
}

if (publicForm && publicContent) {
  publicForm.addEventListener("submit", async event => {
    event.preventDefault();
    const content = publicContent.value.trim();
    let songUrl = "";
    let songName = "";
    const songFile = publicSongFile?.files?.[0];
    if (songFile) {
      try {
        const uploaded = await uploadSongFile(songFile);
        if (uploaded) {
          songUrl = uploaded.path;
          songName = uploaded.name;
        } else {
          songUrl = await readFileAsDataURL(songFile);
          songName = songFile.name;
        }
      } catch {
        alert("Unable to upload song.");
      }
    }
    let imageData = null;
    const file = publicImageInput?.files?.[0];
    if (file) {
      try {
        imageData = await readFileAsDataURL(file);
      } catch {
        alert("Unable to upload image.");
      }
    }
    if (!content && !imageData && !songUrl) return;
    sendPublicMessage(content, imageData, songUrl, songName);
    publicContent.value = "";
    if (publicImageInput) publicImageInput.value = "";
    if (publicSongFile) publicSongFile.value = "";
  });
}

if (replyButton && conversationReply) {
  replyButton.addEventListener("click", async () => {
    const current = getCurrentUser();
    if (!currentConversation || !current || !conversationReply.value.trim()) return;
    let songUrl = "";
    let songName = "";
    const songFile = replySongFile?.files?.[0];
    if (songFile) {
      const uploaded = await uploadSongFile(songFile);
      if (uploaded) {
        songUrl = uploaded.path;
        songName = uploaded.name;
      } else {
        songUrl = await readFileAsDataURL(songFile);
        songName = songFile.name;
      }
    }
    sendMessage(currentConversation, conversationReply.value, null, songUrl, songName);
    conversationReply.value = "";
    if (replySongFile) replySongFile.value = "";
    renderConversation(currentConversation);
  });
}

const editAvatarButton = document.getElementById("editAvatarButton");
const avatarInput = document.getElementById("avatarInput");
const resetAvatarButton = document.getElementById("resetAvatarButton");
if (editAvatarButton && avatarInput) {
  editAvatarButton.addEventListener("click", () => avatarInput.click());
  avatarInput.addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const current = getCurrentUser();
      if (!current) return;
      current.avatar = reader.result;
      updateUser(current);
      renderProfile();
    };
    reader.readAsDataURL(file);
  });
}

if (resetAvatarButton) {
  resetAvatarButton.addEventListener("click", () => {
    const current = getCurrentUser();
    if (!current) return;
    current.avatar = null;
    updateUser(current);
    renderProfile();
  });
}

const toggleActiveButton = document.getElementById("toggleActiveButton");
const editStatusButton = document.getElementById("editStatusButton");
const statusEditor = document.getElementById("statusEditor");
const saveStatusButton = document.getElementById("saveStatusButton");
const statusInput = document.getElementById("statusInput");

if (toggleActiveButton) {
  toggleActiveButton.addEventListener("click", () => {
    const current = getCurrentUser();
    if (!current) return;
    setCurrentUserActive(!current.active);
    renderProfile();
  });
}

if (editStatusButton && statusEditor) {
  editStatusButton.addEventListener("click", () => statusEditor.classList.toggle("hidden"));
}

if (saveStatusButton && statusInput) {
  saveStatusButton.addEventListener("click", () => {
    if (!statusInput.value.trim()) return;
    updateStatus(statusInput.value.trim());
    statusInput.value = "";
    statusEditor.classList.add("hidden");
    renderProfile();
  });
}

const reactionPickerElement = document.getElementById("reactionPicker");
if (reactionPickerElement) {
  reactionPickerElement.addEventListener("click", event => {
    if (!event.target.matches("button[data-emoji]")) return;
    const emoji = event.target.dataset.emoji;
    const messageId = reactionPickerElement.dataset.messageId;
    const messageType = reactionPickerElement.dataset.messageType;
    if (messageId && emoji) {
      addReaction(messageId, messageType, emoji);
    }
    hideReactionPicker();
  });
}

document.body.addEventListener("mousedown", event => {
  const bubble = event.target.closest(".message-bubble, .public-message");
  if (!bubble) return;
  longPressTimer = window.setTimeout(() => {
    const messageId = bubble.dataset.messageId;
    const type = bubble.dataset.messageType || "public";
    if (messageId) {
      activateLongPress(bubble, messageId, type);
    }
  }, 600);
});

document.body.addEventListener("mouseup", () => {
  clearTimeout(longPressTimer);
});

document.body.addEventListener("touchstart", event => {
  const bubble = event.target.closest(".message-bubble, .public-message");
  if (!bubble) return;
  longPressTimer = window.setTimeout(() => {
    const messageId = bubble.dataset.messageId;
    const type = bubble.dataset.messageType || "public";
    if (messageId) {
      activateLongPress(bubble, messageId, type);
    }
  }, 600);
});

document.body.addEventListener("touchend", () => {
  clearTimeout(longPressTimer);
});

document.body.addEventListener("click", event => {
  if (event.target.matches(".add-friend")) {
    addFriend(event.target.dataset.username);
  }
  if (event.target.matches(".remove-friend")) {
    removeFriend(event.target.dataset.username);
  }
  if (event.target.matches(".message-user")) {
    openConversation(event.target.dataset.username);
  }
  if (event.target.matches(".message-thread")) {
    openConversation(event.target.dataset.username);
  }
  if (event.target.matches(".delete-message")) {
    deleteMessage(event.target.dataset.messageId);
  }
  if (event.target.matches(".delete-public")) {
    deletePublicMessage(event.target.dataset.messageId);
  }
  if (event.target.matches(".delete-link") && event.target.dataset.postId) {
    deletePost(event.target.dataset.postId);
  }
});

window.addEventListener("beforeunload", () => {
  const current = getCurrentUser();
  if (current) {
    current.active = false;
    updateUser(current);
  }
});

renderPosts();
renderPublicMessages();
renderFriendSuggestions("friendSuggestions");
renderMessages();
renderMessageRecipients();
renderProfile();
hideReactionPicker();
