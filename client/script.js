class ChatApp {
    constructor() {
        this.messages = new Map();
        this.socket = io("https://your-render-backend-url", {
            withCredentials: true
        });

        // Wait for Google library to load
        window.onload = () => {
            if (typeof google !== 'undefined') {
                this.setupGoogleSignIn();
            } else {
                // If Google library isn't loaded yet, wait for it
                window.onGoogleLibraryLoad = () => {
                    this.setupGoogleSignIn();
                };
            }
        };

        this.currentUser = null;
        this.currentUserProfile = null;
        this.currentRecipient = null;
        this.typingTimeout = null;
        this.themeManager = new ThemeManager();
        this.activeUsers = new Map();
        this.currentUser = null;
        this.currentUserProfile = null;
        this.currentRecipient = null;
        this.typingTimeout = null;
        this.themeManager = new ThemeManager();
        this.activeUsers = new Map();
        this.setupGoogleSignIn();
        this.setupSocketListeners();
        this.setupEventListeners();
        // this.initializeUI();
    }

    setupGoogleSignIn() {
        google.accounts.id.initialize({
            client_id: '51565630705-8tp5ar0uouqr70pannk4ptq38fquniir.apps.googleusercontent.com',
            callback: this.handleGoogleSignIn.bind(this)
        });

        google.accounts.id.renderButton(
            document.getElementById('googleSignIn'),
            { theme: 'outline', size: 'large' }
        );
    }

    handleGoogleSignIn(response) {
        if (!response || !response.credential) {
            console.error('Invalid Google sign-in response');
            alert('Google sign-in failed. Please try again.');
            return;
        }

        console.log('Received credential:', response.credential);

        const loginStatusElement = document.getElementById('loginStatus');
        if (loginStatusElement) {
            loginStatusElement.textContent = 'Signing in...';
        }

        fetch('https://your-render-backend-url/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ credential: response.credential })
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(err => {
                    throw new Error(err.message || 'Login failed');
                });
            }
            return res.json();
        })
        .then(data => {
            console.log('Login successful:', data);
            this.handleSuccessfulLogin({
                userId: data.userId,
                profile: data.profile,
                email: data.email
            });
        })
        .catch(error => {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
            if (loginStatusElement) {
                loginStatusElement.textContent = 'Login failed';
            }
        });
    }

    handleSuccessfulLogin(userData) {
        this.currentUser = userData.userId;
        this.currentUserProfile = {
            displayName: userData.profile.name,
            email: userData.email,
            bio: userData.profile.bio || 'No bio provided',
            avatarColor: this.generateRandomColor(),
            photoURL: userData.profile.picture,
            status: 'online'
        };

        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';

        this.socket.emit('register', {
            userId: this.currentUser,
            profile: this.currentUserProfile
        });

        this.updateCurrentUserProfile();
    }

    handleSignOut() {
        this.currentUser = null;
        this.currentUserProfile = null;
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('chatContainer').style.display = 'none';
        
        // Emit disconnect event to socket
        this.socket.emit('userDisconnect', { userId: this.currentUser });
    }

    setupEventListeners() {
        // Add Google Sign-In button listener
        const googleSignInBtn = document.getElementById('googleSignIn');
        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', () => this.signInWithGoogle());
        }

        // Rest of your existing event listeners...
    }
  
    async signInWithGoogle() {
        try {
            // We don't need to manually trigger the sign-in since Google's client library
            // handles this through the renderButton() configuration we set up in setupGoogleSignIn()
            
            // If you need to programmatically trigger sign in, you can use:
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // Handle cases where the prompt isn't displayed
                    console.warn('Google sign-in prompt not displayed:', notification);
                    alert('Please ensure pop-ups are enabled and try again.');
                }
            });
        } catch (error) {
            console.error('Error signing in with Google:', error);
            alert('Failed to sign in with Google. Please try again.');
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
    
        this.socket.on('userList', (users) => {
            this.updateUserList(users);
        });
    
        this.socket.on('privateMessage', (data) => {
            this.receiveMessage(data);
        });
    
        this.socket.on('userTyping', (data) => {
            this.showTypingIndicator(data);
        });
    
        this.socket.on('userStatusUpdate', (data) => {
            this.updateUserStatus(data);
        });
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.handleTyping();
            });
        }
    }

    handleLogin() {
        const userIdInput = document.getElementById('userId');
        const displayNameInput = document.getElementById('displayName');
        const emailInput = document.getElementById('email');
        const bioInput = document.getElementById('bio');
        const selectedColorInput = document.querySelector('input[name="avatarColor"]:checked');
    
        if (!userIdInput.value.trim()) {
            alert('Please enter a username');
            return;
        }
    
        const userId = userIdInput.value.trim();
        const profile = {
            displayName: displayNameInput.value.trim() || userId,
            email: emailInput.value.trim(),
            bio: bioInput.value.trim() || 'No bio provided',
            avatarColor: selectedColorInput ? selectedColorInput.value : this.generateRandomColor(),
            status: 'online'
        };
    
        // Rest of the code remains the same...
    

        this.currentUser = userId;
        this.currentUserProfile = profile;

        this.socket.emit('register', {
            userId,
            profile: {
                ...profile,
                status: 'online'
            }
        });

        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';

        this.updateCurrentUserProfile();
    }

    generateRandomColor() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updateCurrentUserProfile() {
        const profileContainer = document.getElementById('currentUserProfile');
        if (profileContainer && this.currentUserProfile) {
            const profileHtml = `
                <div class="avatar" style="background-color: ${this.currentUserProfile.avatarColor}">
                    ${this.currentUserProfile.displayName.charAt(0).toUpperCase()}
                </div>
                <h3>${this.currentUserProfile.displayName}</h3>
                <p class="status">${this.currentUserProfile.status}</p>
                <p class="bio">${this.currentUserProfile.bio}</p>
            `;
            profileContainer.innerHTML = profileHtml;
        }
    }

    updateUserList(users) {
        const userList = document.getElementById('userList');
        if (!userList) return;

        userList.innerHTML = '';
        
        users.forEach(user => {
            if (user.userId !== this.currentUser) {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.dataset.userId = user.userId;

                const displayName = user.profile?.displayName || user.userId;
                const avatarColor = user.profile?.avatarColor || '#ccc';
                const avatarInitial = displayName.charAt(0).toUpperCase();
                
                if (user.status === 'online') {
                    userElement.classList.add('active');
                }

                const statusIndicator = user.status === 'online' ? 
                    '<span class="status-indicator online"></span>' : 
                    '<span class="status-indicator offline"></span>';

                    userElement.innerHTML = `
                    ${statusIndicator}
                    <div class="avatar" style="background-color: ${avatarColor}">
                        ${avatarInitial}
                    </div>
                    <div class="user-info">
                        <h4>${displayName}</h4>
                        <p class="status">${user.status}</p>
                    </div>
                `;
                
                userElement.addEventListener('click', () => this.selectRecipient(user));
                userList.appendChild(userElement);
            }
        });
    }

    updateUserStatus(data) {
        const { userId, status } = data;
        const userElement = document.querySelector(`.user-item[data-user-id="${userId}"]`);
        
        if (userElement) {
            const statusElement = userElement.querySelector('.status');
            const statusIndicator = userElement.querySelector('.status-indicator');
            
            if (statusElement) {
                statusElement.textContent = status;
            }
            
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${status}`;
            }
            
            userElement.classList.toggle('active', status === 'online');
        }

        if (status === 'online') {
            this.activeUsers.set(userId, data);
        } else {
            this.activeUsers.delete(userId);
        }
    }

    getConversationKey(user1, user2) {
        return [user1, user2].sort().join(':');
    }

    selectRecipient(user) {
        this.currentRecipient = user.userId;
        const chatHeader = document.getElementById('chatHeader');
        const chatMessages = document.getElementById('chatMessages');
        
        if (chatHeader) {

            const displayName = user.profile?.displayName || user.userId;
            const avatarColor = user.profile?.avatarColor || '#ccc';
            const avatarInitial = displayName.charAt(0).toUpperCase();


            chatHeader.innerHTML = `
                 <div class="avatar" style="background-color: ${avatarColor}">
                    ${avatarInitial}
                </div>
                <div class="user-info">
                    <h4>${displayName}</h4>
                    <p class="status">${user.status}</p>
                </div>
            `;
        }

        // Clear previous messages and load conversation history
        if (chatMessages) {
            chatMessages.innerHTML = '';
            const conversationKey = this.getConversationKey(this.currentUser, this.currentRecipient);
            const messages = this.messages.get(conversationKey) || [];
            messages.forEach(msg => this.addMessageToChat(msg, 
                msg.senderId === this.currentUser ? 'sent' : 'received'));
        }

        const messageInput = document.getElementById('messageInput');
        const sendButton = document.querySelector('#messageForm button');
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.focus();
        }
        if (sendButton) sendButton.disabled = false;

        document.querySelectorAll('#userList .user-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.userId === user.userId) {
                item.classList.add('active');
            }
        });
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput || !this.currentRecipient || !this.currentUserProfile) return;

        const message = messageInput.value.trim();
        if (message) {
            const messageData = {
                senderId: this.currentUser,
                senderProfile: this.currentUserProfile,
                recipientId: this.currentRecipient,
                message: message,
                timestamp: new Date()
            };

            // Store message in local conversation history
            const conversationKey = this.getConversationKey(this.currentUser, this.currentRecipient);
            if (!this.messages.has(conversationKey)) {
                this.messages.set(conversationKey, []);
            }
            this.messages.get(conversationKey).push(messageData);

            this.socket.emit('privateMessage', messageData);
            this.addMessageToChat(messageData, 'sent');
            messageInput.value = '';
        }
    }

    receiveMessage(data) {
        // Store received message in conversation history
        const conversationKey = this.getConversationKey(this.currentUser, data.senderId);
        if (!this.messages.has(conversationKey)) {
            this.messages.set(conversationKey, []);
        }
        this.messages.get(conversationKey).push(data);

        // Only show message if we're currently chatting with the sender
        if (data.senderId === this.currentRecipient) {
            this.addMessageToChat(data, 'received');
        }
    }

    addMessageToChat(data, type) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);

        const displayName = data.senderProfile?.displayName || data.senderId;
        const avatarColor = data.senderProfile?.avatarColor || '#ccc';
        const avatarInitial = displayName.charAt(0).toUpperCase();
        
        const avatarElement = document.createElement('div');
        avatarElement.className = 'message-avatar';
        avatarElement.style.backgroundColor = avatarColor;
        avatarElement.textContent = avatarInitial;

        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = data.message;
        
        const timeElement = document.createElement('div');
        timeElement.className = 'timestamp';
        timeElement.textContent = new Date(data.timestamp).toLocaleTimeString();
        
        contentElement.appendChild(messageText);
        contentElement.appendChild(timeElement);
        messageElement.appendChild(avatarElement);
        messageElement.appendChild(contentElement);
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    handleTyping() {
        if (this.currentRecipient) {
            this.socket.emit('typing', {
                senderId: this.currentUser,
                senderProfile:this.currentUserProfile,
                recipientId: this.currentRecipient,
                isTyping: true
            });

            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
                this.socket.emit('typing', {
                    senderId: this.currentUser,
                    senderProfile:this.currentUserProfile,
                    recipientId: this.currentRecipient,
                    isTyping: false
                });
            }, 1000);
        }
    }

    showTypingIndicator(data) {
        const typingIndicator = document.getElementById('typingIndicator');
        const typingText = typingIndicator?.querySelector('.typing-text');
        if (typingIndicator && data.senderId === this.currentRecipient) {
            const userProfile = this.activeUsers.get(data.senderId);
            const displayName = userProfile?.profile?.displayName || data.senderId;

            typingIndicator.style.display = data.isTyping ? 'block' : 'none';
            typingIndicator.textContent = `${data.senderId} is typing...`;
        }
    }

    handleProfileUpdate(data) {
        const userElement = document.querySelector(`.user-item[data-user-id="${data.userId}"]`);
        if (userElement) {
            const statusElement = userElement.querySelector('.status');
            if (statusElement) {
                statusElement.textContent = data.profile.status;
            }
        }
    }
}
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.toggleBtn = document.getElementById('themeToggle');
        this.initialize();
    }

    initialize() {
        // Set initial theme
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Add click event listener
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleTheme());
            this.updateButtonState();
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.theme = e.matches ? 'dark' : 'light';
                this.applyTheme();
            }
        });
    

        
        // Set initial button state
        this.updateButtonState();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        this.updateButtonState();
    }

    updateButtonState() {
        if (this.toggleBtn) {
            const title = this.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
            this.toggleBtn.setAttribute('title', title);
            this.toggleBtn.setAttribute('aria-label', title);
        }
    }
}

// Initialize the chat app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const chat = new ChatApp();
    document.addEventListener('DOMContentLoaded', () => {
        new ThemeManager();
    });
});