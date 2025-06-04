// dashboard.js

// Utility function for DOM selection
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

// State management
const state = {
  activeSection: 'feed',
  posts: [],
  postsLeft: 3, // Increased for testing
  notifications: [
    { id: 'notif-1', message: 'New job match available!', time: new Date().toISOString(), read: false },
    { id: 'notif-2', message: 'Sarah Miller liked your post.', time: new Date().toISOString(), read: false },
    { id: 'notif-3', message: 'New message from Robert Johnson.', time: new Date().toISOString(), read: false },
  ],
  messages: [
    { id: 'msg-1', sender: 'Sarah Miller', content: 'Hey, great post on ML!', time: new Date().toISOString() },
    { id: 'msg-2', sender: 'Robert Johnson', content: 'Can we discuss React resources?', time: new Date().toISOString() },
  ],
  isCommenting: false,
  attachedMedia: null, // For image, link, or document
  polls: [], // Store polls
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

// Main initialization function
function initializeApp() {
  try {
    // Set initial active section
    showSection(state.activeSection);

    // Event listeners for navigation buttons
    $$('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => showSection(btn.getAttribute('onclick').match(/'([^']+)'/)[1], btn));
    });

    // Event listeners for post composer
    $('#postContent').addEventListener('input', updatePostLimit);
    $('.submit-post').addEventListener('click', createPost);

    // Event listeners for post actions
    $$('.action-btn').forEach((btn) => {
      if (btn.classList.contains('bookmark')) {
        btn.addEventListener('click', toggleBookmark);
      }
    });

    // Initialize media buttons
    $$('.media-btn').forEach((btn) => {
      btn.addEventListener('click', handleMediaAction);
    });

    // Initialize notification and message buttons
    $('.notification-btn').addEventListener('click', showNotifications);
    $('.messages-btn').addEventListener('click', showMessages);

    // Load initial posts
    loadPosts();
  } catch (error) {
    console.error('Error initializing app:', error);
    showError('Failed to initialize the application. Please try again.');
  }
}

// Show specific section and update navigation
function showSection(sectionId, button = null) {
  try {
    // Update active section
    $$('.section').forEach((section) => {
      section.classList.toggle('active', section.id === `${sectionId}-section`);
    });

    // Update active navigation button
    if (button) {
      $$('.nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn === button);
        btn.setAttribute('aria-selected', btn === button);
      });
    }

    state.activeSection = sectionId;

    // Load section-specific content
    switch (sectionId) {
      case 'feed':
        loadPosts();
        break;
      case 'profile':
        loadProfile();
        break;
      case 'career':
        loadCareerAI();
        break;
      case 'cv':
        loadCVParser();
        break;
      case 'communities':
        loadCommunities();
        break;
      default:
        console.warn(`Unknown section: ${sectionId}`);
    }
  } catch (error) {
    console.error(`Error showing section ${sectionId}:`, error);
    showError(`Failed to load ${sectionId} section.`);
  }
}

// Load posts for the feed
function loadPosts() {
  try {
    const feedContainer = $('#feed-container');
    feedContainer.innerHTML = ''; // Clear existing posts
    state.posts.forEach((post) => {
      const postElement = createPostElement(post);
      feedContainer.appendChild(postElement);
    });
    // Re-attach event listeners for dynamically created posts
    $$('.action-btn').forEach((btn) => {
      if (btn.classList.contains('bookmark')) {
        btn.addEventListener('click', toggleBookmark);
      } else if (btn.querySelector('i.fa-thumbs-up')) {
        btn.addEventListener('click', toggleUpvote);
      } else if (btn.querySelector('i.fa-comment')) {
        btn.addEventListener('click', toggleComments);
      } else if (btn.querySelector('i.fa-share')) {
        btn.addEventListener('click', sharePost);
      }
    });
    // Re-attach poll voting listeners
    $$('.poll-option').forEach((option) => {
      option.addEventListener('click', votePoll);
    });
  } catch (error) {
    console.error('Error loading posts:', error);
    showError('Failed to load posts.');
  }
}

// Create a new post
function createPost() {
  try {
    const content = DOMPurify.sanitize($('#postContent').value.trim());
    if (!content && !state.attachedMedia) {
      showError('Post content or media cannot be empty.');
      return;
    }

    if (state.postsLeft <= 0) {
      showError('You have reached your daily post limit.');
      return;
    }

    const newPost = {
      id: `post-${Date.now()}`,
      author: $('#sidebarName').textContent,
      avatar: $('#sidebarAvatar img').src,
      content,
      media: state.attachedMedia,
      timestamp: new Date().toISOString(),
      likes: 0,
      comments: [],
      shares: 0,
      tags: extractTags(content),
    };

    state.posts.unshift(newPost);
    state.postsLeft--;
    $('#postsLeft').textContent = state.postsLeft;
    $('#postContent').value = '';
    state.attachedMedia = null;
    $('.composer-media-preview').innerHTML = ''; // Clear media preview

    // Update UI
    loadPosts();
    showSuccess('Post created successfully!');
  } catch (error) {
    console.error('Error creating post:', error);
    showError('Failed to create post.');
  }
}

// Extract hashtags from content
function extractTags(content) {
  const tagRegex = /#[\w]+/g;
  return content.match(tagRegex) || [];
}

// Create post element
function createPostElement(post) {
  const postElement = document.createElement('article');
  postElement.className = 'post modern-card';
  postElement.id = post.id;

  let mediaContent = '';
  if (post.media) {
    if (post.media.type === 'image') {
      mediaContent = `<img src="${post.media.url}" alt="Post image" class="post-media" style="max-width: 100%; border-radius: var(--radius-md); margin-top: var(--spacing-md);">`;
    } else if (post.media.type === 'link') {
      mediaContent = `<a href="${post.media.url}" target="_blank" class="post-link">${post.media.url}</a>`;
    } else if (post.media.type === 'document') {
      mediaContent = `<div class="post-document"><i class="fas fa-file"></i> ${post.media.name}</div>`;
    } else if (post.media.type === 'poll') {
      const poll = state.polls.find((p) => p.id === post.media.pollId);
      mediaContent = `
        <div class="post-poll">
          <h4>${poll.question}</h4>
          ${poll.options
            .map(
              (opt, idx) => `
                <div class="poll-option" data-poll-id="${poll.id}" data-option-id="${idx}">
                  <span>${opt.text}</span>
                  <span class="poll-votes">${opt.votes} votes</span>
                  <div class="poll-progress" style="width: ${
                    poll.totalVotes > 0 ? (opt.votes / poll.totalVotes) * 100 : 0
                  }%"></div>
                </div>
              `
            )
            .join('')}
          <div class="poll-total">Total votes: ${poll.totalVotes}</div>
        </div>
      `;
    }
  }

  postElement.innerHTML = `
    <div class="post-header">
      <img src="${post.avatar}" alt="${post.author}" class="post-avatar">
      <div class="post-info">
        <div class="post-author">
          <h4>${post.author}</h4>
        </div>
        <div class="post-meta">
          <span class="post-time">${formatTime(post.timestamp)}</span>
          <span class="post-visibility"><i class="fas fa-globe"></i> Public</span>
        </div>
      </div>
      <button class="post-menu" aria-label="Post options">
        <i class="fas fa-ellipsis-h"></i>
      </button>
    </div>
    <div class="post-content">
      <p>${post.content}</p>
      ${mediaContent}
      <div class="post-tags">
        ${post.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
      </div>
    </div>
    <div class="post-engagement">
      <div class="engagement-stats">
        <span class="stat"><i class="fas fa-thumbs-up"></i> ${post.likes} likes</span>
        <span class="stat">${post.comments.length} comments</span>
        <span class="stat">${post.shares} shares</span>
      </div>
    </div>
    <div class="post-actions">
      <button class="action-btn">
        <i class="far fa-thumbs-up"></i>
        <span>Like</span>
      </button>
      <button class="action-btn">
        <i class="far fa-comment"></i>
        <span>Comment</span>
      </button>
      <button class="action-btn">
        <i class="fas fa-share"></i>
        <span>Share</span>
      </button>
      <button class="action-btn bookmark">
        <i class="far fa-bookmark"></i>
        <span>Save</span>
      </button>
    </div>
  `;

  return postElement;
}

// Format timestamp
function formatTime(timestamp) {
  const now = new Date();
  const postTime = new Date(timestamp);
  const diff = (now - postTime) / 1000; // Difference in seconds

  if (diff < 60) return `${Math.floor(diff)} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

// Toggle upvote
function toggleUpvote(button) {
  try {
    const postElement = button.closest('.post');
    const postId = postElement.id;
    const post = state.posts.find((p) => p.id === postId);
    const isActive = button.classList.contains('active');

    if (!isActive) {
      post.likes++;
      button.classList.add('active');
      button.querySelector('i').className = 'fas fa-thumbs-up';
    } else {
      post.likes--;
      button.classList.remove('active');
      button.querySelector('i').className = 'far fa-thumbs-up';
    }

    // Update UI
    const stat = postElement.querySelector('.engagement-stats .stat');
    stat.innerHTML = `<i class="fas fa-thumbs-up"></i> ${post.likes} likes`;
  } catch (error) {
    console.error('Error toggling upvote:', error);
    showError('Failed to update like.');
  }
}

// Toggle comments section
function toggleComments(button) {
  try {
    const postElement = button.closest('.post');
    let commentsSection = postElement.querySelector('.comments-section');

    if (!commentsSection) {
      commentsSection = document.createElement('div');
      commentsSection.className = 'comments-section';
      commentsSection.style.marginTop = 'var(--spacing-lg)';
      commentsSection.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
      commentsSection.style.paddingTop = 'var(--spacing-lg)';
      postElement.appendChild(commentsSection);

      const commentInput = document.createElement('div');
      commentInput.className = 'comment-input';
      commentInput.innerHTML = `
        <textarea class="comment-textarea" placeholder="Write a comment..." aria-label="Write a comment"></textarea>
        <button class="submit-comment" onclick="submitComment(this)">Post</button>
      `;
      commentsSection.appendChild(commentInput);

      // Render existing comments
      const postId = postElement.id;
      const post = state.posts.find((p) => p.id === postId);
      post.comments.forEach((comment) => {
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        commentElement.innerHTML = `
          <div class="comment-author">${comment.author}</div>
          <div class="comment-content">${comment.content}</div>
          <div class="comment-time">${formatTime(comment.timestamp)}</div>
        `;
        commentsSection.insertBefore(commentElement, commentInput);
      });
    }

    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    state.isCommenting = commentsSection.style.display === 'block';
  } catch (error) {
    console.error('Error toggling comments:', error);
    showError('Failed to toggle comments.');
  }
}

// Submit a comment
function submitComment(button) {
  try {
    const postElement = button.closest('.post');
    const postId = postElement.id;
    const textarea = postElement.querySelector('.comment-textarea');
    const content = DOMPurify.sanitize(textarea.value.trim());

    if (!content) {
      showError('Comment cannot be empty.');
      return;
    }

    const post = state.posts.find((p) => p.id === postId);
    post.comments.push({
      id: `comment-${Date.now()}`,
      author: $('#sidebarName').textContent,
      content,
      timestamp: new Date().toISOString(),
    });

    // Update comments UI
    const commentsSection = postElement.querySelector('.comments-section');
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.innerHTML = `
      <div class="comment-author">${post.comments[post.comments.length - 1].author}</div>
      <div class="comment-content">${content}</div>
      <div class="comment-time">${formatTime(new Date().toISOString())}</div>
    `;
    commentsSection.insertBefore(commentElement, commentsSection.querySelector('.comment-input'));
    textarea.value = '';

    // Update comment count
    const stat = postElement.querySelectorAll('.engagement-stats .stat')[1];
    stat.textContent = `${post.comments.length} comments`;
  } catch (error) {
    console.error('Error submitting comment:', error);
    showError('Failed to post comment.');
  }
}

// Share post
function sharePost(button) {
  try {
    const postElement = button.closest('.post');
    const postId = postElement.id;
    const post = state.posts.find((p) => p.id === postId);
    post.shares++;
    const stat = postElement.querySelectorAll('.engagement-stats .stat')[2];
    stat.textContent = `${post.shares} shares`;
    showSuccess('Post shared successfully!');
  } catch (error) {
    console.error('Error sharing post:', error);
    showError('Failed to share post.');
  }
}

// Toggle bookmark
function toggleBookmark(event) {
  try {
    const button = event.currentTarget;
    const isBookmarked = button.classList.contains('active');
    button.classList.toggle('active');
    button.querySelector('i').className = isBookmarked ? 'far fa-bookmark' : 'fas fa-bookmark';
    showSuccess(isBookmarked ? 'Post removed from bookmarks.' : 'Post saved to bookmarks.');
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    showError('Failed to toggle bookmark.');
  }
}

// Handle media actions
function handleMediaAction(event) {
  const action = event.currentTarget.querySelector('span').textContent.toLowerCase();
  switch (action) {
    case 'photo':
      addImage();
      break;
    case 'link':
      addLink();
      break;
    case 'document':
      addDocument();
      break;
    case 'poll':
      createPoll();
      break;
    default:
      console.warn(`Unknown media action: ${action}`);
  }
}

// Add image
function addImage() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) {
        showError('No image selected.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('Image size exceeds 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        state.attachedMedia = { type: 'image', url: e.target.result };
        const preview = $('.composer-media-preview') || document.createElement('div');
        preview.className = 'composer-media-preview';
        preview.style.marginTop = 'var(--spacing-md)';
        preview.innerHTML = `<img src="${e.target.result}" alt="Image preview" style="max-width: 100%; border-radius: var(--radius-md);">`;
        $('.post-composer').insertBefore(preview, $('.composer-actions'));
        showSuccess('Image attached successfully!');
      };
      reader.readAsDataURL(file);
    });

    input.click();
    document.body.removeChild(input);
  } catch (error) {
    console.error('Error adding image:', error);
    showError('Failed to attach image.');
  }
}

// Add link
function addLink() {
  try {
    const url = prompt('Enter a URL to attach:', 'https://');
    if (!url) {
      showError('No URL provided.');
      return;
    }

    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    if (!urlRegex.test(url)) {
      showError('Please enter a valid URL.');
      return;
    }

    state.attachedMedia = { type: 'link', url: url.startsWith('http') ? url : `https://${url}` };
    const preview = $('.composer-media-preview') || document.createElement('div');
    preview.className = 'composer-media-preview';
    preview.style.marginTop = 'var(--spacing-md)';
    preview.innerHTML = `<a href="${state.attachedMedia.url}" target="_blank" class="post-link">${state.attachedMedia.url}</a>`;
    $('.post-composer').insertBefore(preview, $('.composer-actions'));
    showSuccess('Link attached successfully!');
  } catch (error) {
    console.error('Error adding link:', error);
    showError('Failed to attach link.');
  }
}

// Add document
function addDocument() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) {
        showError('No document selected.');
        return;
      }

      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        showError('Please select a valid document (PDF, DOC, DOCX).');
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        showError('Document size exceeds 10MB.');
        return;
      }

      state.attachedMedia = { type: 'document', name: file.name, url: URL.createObjectURL(file) };
      const preview = $('.composer-media-preview') || document.createElement('div');
      preview.className = 'composer-media-preview';
      preview.style.marginTop = 'var(--spacing-md)';
      preview.innerHTML = `<div class="post-document"><i class="fas fa-file"></i> ${file.name}</div>`;
      $('.post-composer').insertBefore(preview, $('.composer-actions'));
      showSuccess('Document attached successfully!');
    });

    input.click();
    document.body.removeChild(input);
  } catch (error) {
    console.error('Error adding document:', error);
    showError('Failed to attach document.');
  }
}

// Create poll
function createPoll() {
  try {
    const modal = document.createElement('div');
    modal.className = 'poll-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0, 0, 0, 0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';

    modal.innerHTML = `
      <div class="poll-form" style="background: var(--bg-glass); padding: var(--spacing-xl); border-radius: var(--radius-xl); max-width: 500px; width: 90%;">
        <h3>Create a Poll</h3>
        <input type="text" id="pollQuestion" placeholder="Enter your question" style="width: 100%; padding: var(--spacing-md); margin-bottom: var(--spacing-md); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); background: transparent; color: var(--text-primary);">
        <div id="pollOptions">
          <input type="text" class="poll-option-input" placeholder="Option 1" style="width: 100%; padding: var(--spacing-md); margin-bottom: var(--spacing-md); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); background: transparent; color: var(--text-primary);">
          <input type="text" class="poll-option-input" placeholder="Option 2" style="width: 100%; padding: var(--spacing-md); margin-bottom: var(--spacing-md); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); background: transparent; color: var(--text-primary);">
        </div>
        <button class="add-option" style="background: transparent; border: none; color: var(--text-accent); margin-bottom: var(--spacing-md);">+ Add Option</button>
        <div style="display: flex; gap: var(--spacing-md);">
          <button class="submit-poll" style="flex: 1; padding: var(--spacing-md); background: var(--primary-gradient); color: white; border: none; border-radius: var(--radius-md); cursor: pointer;">Create Poll</button>
          <button class="cancel-poll" style="flex: 1; padding: var(--spacing-md); background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-secondary); border-radius: var(--radius-md); cursor: pointer;">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.add-option').addEventListener('click', () => {
      const optionInput = document.createElement('input');
      optionInput.type = 'text';
      optionInput.className = 'poll-option-input';
      optionInput.placeholder = `Option ${modal.querySelectorAll('.poll-option-input').length + 1}`;
      optionInput.style.cssText = 'width: 100%; padding: var(--spacing-md); margin-bottom: var(--spacing-md); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); background: transparent; color: var(--text-primary);';
      modal.querySelector('#pollOptions').appendChild(optionInput);
    });

    modal.querySelector('.submit-poll').addEventListener('click', () => {
      const question = DOMPurify.sanitize(modal.querySelector('#pollQuestion').value.trim());
      const options = Array.from(modal.querySelectorAll('.poll-option-input'))
        .map((input) => DOMPurify.sanitize(input.value.trim()))
        .filter((opt) => opt);

      if (!question || options.length < 2) {
        showError('Poll must have a question and at least two options.');
        return;
      }

      const poll = {
        id: `poll-${Date.now()}`,
        question,
        options: options.map((text) => ({ text, votes: 0 })),
        totalVotes: 0,
      };

      state.polls.push(poll);
      state.attachedMedia = { type: 'poll', pollId: poll.id };
      const preview = $('.composer-media-preview') || document.createElement('div');
      preview.className = 'composer-media-preview';
      preview.style.marginTop = 'var(--spacing-md)';
      preview.innerHTML = `<div class="poll-preview"><h4>${poll.question}</h4>${poll.options.map((opt) => `<p>${opt.text}</p>`).join('')}</div>`;
      $('.post-composer').insertBefore(preview, $('.composer-actions'));
      document.body.removeChild(modal);
      showSuccess('Poll created successfully!');
    });

    modal.querySelector('.cancel-poll').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  } catch (error) {
    console.error('Error creating poll:', error);
    showError('Failed to create poll.');
  }
}

// Vote in a poll
function votePoll(event) {
  try {
    const optionElement = event.currentTarget;
    const pollId = optionElement.dataset.pollId;
    const optionId = parseInt(optionElement.dataset.optionId);
    const poll = state.polls.find((p) => p.id === pollId);

    poll.options[optionId].votes++;
    poll.totalVotes++;

    // Update UI
    const postElement = optionElement.closest('.post');
    const pollContainer = postElement.querySelector('.post-poll');
    pollContainer.innerHTML = `
      <h4>${poll.question}</h4>
      ${poll.options
        .map(
          (opt, idx) => `
            <div class="poll-option" data-poll-id="${poll.id}" data-option-id="${idx}">
              <span>${opt.text}</span>
              <span class="poll-votes">${opt.votes} votes</span>
              <div class="poll-progress" style="width: ${
                poll.totalVotes > 0 ? (opt.votes / poll.totalVotes) * 100 : 0
              }%"></div>
            </div>
          `
        )
        .join('')}
      <div class="poll-total">Total votes: ${poll.totalVotes}</div>
    `;
    // Re-attach listeners
    $$('.poll-option', postElement).forEach((opt) => {
      opt.addEventListener('click', votePoll);
    });
    showSuccess('Vote recorded!');
  } catch (error) {
    console.error('Error voting in poll:', error);
    showError('Failed to record vote.');
  }
}

// Show notifications
function showNotifications() {
  try {
    const modal = document.createElement('div');
    modal.className = 'notification-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0, 0, 0, 0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';

    modal.innerHTML = `
      <div class="notification-list" style="background: var(--bg-glass); padding: var(--spacing-xl); border-radius: var(--radius-xl); max-width: 500px; width: 90%;">
        <h3>Notifications</h3>
        <div id="notificationItems">
          ${state.notifications
            .map(
              (notif) => `
                <div class="notification-item" style="padding: var(--spacing-md); border-bottom: 1px solid rgba(255, 255, 255, 0.1); ${notif.read ? '' : 'background: var(--bg-glass-hover);'}">
                  <p>${notif.message}</p>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${formatTime(notif.time)}</span>
                </div>
              `
            )
            .join('')}
        </div>
        <button class="close-notifications" style="width: 100%; padding: var(--spacing-md); background: var(--primary-gradient); color: white; border: none; border-radius: var(--radius-md); margin-top: var(--spacing-md); cursor: pointer;">Close</button>
      </div>
    `;

    document.body.appendChild(modal);
    state.notifications.forEach((notif) => (notif.read = true));
    $('.notification-badge').textContent = '0';

    modal.querySelector('.close-notifications').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  } catch (error) {
    console.error('Error showing notifications:', error);
    showError('Failed to show notifications.');
  }
}

// Show messages
function showMessages() {
  try {
    const modal = document.createElement('div');
    modal.className = 'messages-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0, 0, 0, 0.7)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '1000';

    modal.innerHTML = `
      <div class="messages-list" style="background: var(--bg-glass); padding: var(--spacing-xl); border-radius: var(--radius-xl); max-width: 500px; width: 90%;">
        <h3>Messages</h3>
        <div id="messageItems">
          ${state.messages
            .map(
              (msg) => `
                <div class="message-item" style="padding: var(--spacing-md); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                  <div style="font-weight: 600; margin-bottom: var(--spacing-xs);">${msg.sender}</div>
                  <p>${msg.content}</p>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${formatTime(msg.time)}</span>
                </div>
              `
            )
            .join('')}
        </div>
        <div class="message-input" style="margin-top: var(--spacing-md); display: flex; gap: var(--spacing-md);">
          <textarea class="message-textarea" placeholder="Type a message..." style="flex: 1; padding: var(--spacing-md); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md); background: transparent; color: var(--text-primary); resize: none;"></textarea>
          <button class="send-message" style="padding: var(--spacing-md); background: var(--primary-gradient); color: white; border: none; border-radius: var(--radius-md); cursor: pointer;">Send</button>
        </div>
        <button class="close-messages" style="width: 100%; padding: var(--spacing-md); background: transparent; border: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-secondary); border-radius: var(--radius-md); margin-top: var(--spacing-md); cursor: pointer;">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.send-message').addEventListener('click', () => {
      const textarea = modal.querySelector('.message-textarea');
      const content = DOMPurify.sanitize(textarea.value.trim());
      if (!content) {
        showError('Message cannot be empty.');
        return;
      }
      state.messages.push({
        id: `msg-${Date.now()}`,
        sender: $('#sidebarName').textContent,
        content,
        time: new Date().toISOString(),
      });
      const messageItem = document.createElement('div');
      messageItem.className = 'message-item';
      messageItem.style.cssText = 'padding: var(--spacing-md); border-bottom: 1px solid rgba(255, 255, 255, 0.1);';
      messageItem.innerHTML = `
        <div style="font-weight: 600; margin-bottom: var(--spacing-xs);">${$('#sidebarName').textContent}</div>
        <p>${content}</p>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${formatTime(new Date().toISOString())}</span>
      `;
      modal.querySelector('#messageItems').appendChild(messageItem);
      textarea.value = '';
      showSuccess('Message sent!');
    });

    modal.querySelector('.close-messages').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  } catch (error) {
    console.error('Error showing messages:', error);
    showError('Failed to show messages.');
  }
}

// Load profile section (placeholder)
function loadProfile() {
  $('#contentArea').innerHTML = '<div class="section active" id="profile-section"><h2>Profile Section</h2><p>Your profile details will be displayed here.</p></div>';
}

// Load Career AI section (placeholder)
function loadCareerAI() {
  $('#contentArea').innerHTML = '<div class="section active" id="career-section"><h2>Career AI</h2><p>Career AI recommendations will be displayed here.</p></div>';
}

// Load CV Parser section (placeholder)
function loadCVParser() {
  $('#contentArea').innerHTML = '<div class="section active" id="cv-section"><h2>CV Parser</h2><p>CV parsing tools will be displayed here.</p></div>';
}

// Load Communities section (placeholder)
function loadCommunities() {
  $('#contentArea').innerHTML = '<div class="section active" id="communities-section"><h2>Communities</h2><p>Your communities will be displayed here.</p></div>';
}

// Update post limit display
function updatePostLimit() {
  const content = $('#postContent').value;
  const remaining = 280 - content.length; // Example character limit
  $('.post-limit').textContent = `${remaining} characters remaining`;
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.position = 'fixed';
  errorDiv.style.bottom = '20px';
  errorDiv.style.right = '20px';
  errorDiv.style.background = 'var(--secondary-gradient)';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = 'var(--spacing-md)';
  errorDiv.style.borderRadius = 'var(--radius-md)';
  errorDiv.style.boxShadow = 'var(--shadow-md)';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);

  setTimeout(() => {
    errorDiv.style.opacity = '0';
    errorDiv.style.transition = 'opacity var(--transition-normal)';
    setTimeout(() => errorDiv.remove(), 300);
  }, 3000);
}

// Show success message
function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.style.position = 'fixed';
  successDiv.style.bottom = '20px';
  successDiv.style.right = '20px';
  successDiv.style.background = 'var(--success-gradient)';
  successDiv.style.color = 'white';
  successDiv.style.padding = 'var(--spacing-md)';
  successDiv.style.borderRadius = 'var(--radius-md)';
  successDiv.style.boxShadow = 'var(--shadow-md)';
  successDiv.textContent = message;
  document.body.appendChild(successDiv);

  setTimeout(() => {
    successDiv.style.opacity = '0';
    successDiv.style.transition = 'opacity var(--transition-normal)';
    setTimeout(() => successDiv.remove(), 300);
  }, 3000);
}

// Debounce utility for performance optimization
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Add debounce to input events
$('#postContent').addEventListener('input', debounce(updatePostLimit, 200));

// Smooth scroll for anchor links
$$('a[href*="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = anchor.getAttribute('href').substring(1);
    const target = $(`#${targetId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

function toggleUserMenu() {
    const dropdown = document.getElementById('userMenuDropdown');
    dropdown.classList.toggle('show');
}

const supabase = window.supabase.createClient(
      'https://lhcneterxhyctrksvloe.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoY25ldGVyeGh5Y3Rya3N2bG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjEyOTQsImV4cCI6MjA2NDU5NzI5NH0.7V0lgM3YGObRRSWe5YPXxO49KyoMxwFnQMBhmU8uCHE'
    );

function signOut() {
    if (confirm('Are you sure you want to sign out?')) {
  
        // Clear any stored user data
        localStorage.removeItem('user');
        sessionStorage.clear();
        
        // Redirect to login page
        window.location.href = 'joinus.html';
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const userMenu = document.querySelector('.user-menu');
    const dropdown = document.getElementById('userMenuDropdown');
    
    if (!userMenu.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});