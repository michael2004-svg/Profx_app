// Utility functions
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

// State management
const state = {
  activeSection: 'feed',
  posts: [],
  postsLeft: 10,
  notifications: [],
  messages: [],
  attachedMedia: null,
  polls: [],
};

// Supabase client
const supabase = window.supabase.createClient(
  'https://lhcneterxhyctrksvloe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoY25ldGVyeGh5Y3Rya3N2bG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjEyOTQsImV4cCI6MjA2NDU5NzI5NH0.7V0lgM3YGObRRSWe5YPXxO49KyoMxwFnQMBhmU8uCHE'
);

// Initialize app
async function initializeApp() {
  try {
    console.log('initializeApp: Starting');
    console.log('initializeApp: Checking session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('initializeApp: getSession response', { user: session?.user?.email, error: sessionError?.message });
    if (sessionError || !session || !session.user) {
      console.error('initializeApp: No valid session', sessionError?.message);
      const urlParams = new URLSearchParams(window.location.search);
      const redirectCount = parseInt(urlParams.get('redirectCount') || '0');
      if (redirectCount > 2) {
        showError('Redirect loop detected.');
        return;
      }
      window.location.href = `joinus.html?redirectCount=${redirectCount + 1}`;
      return;
    }

    console.log('initializeApp: Session found', session.user.email);
    const today = new Date().toISOString().split('T')[0];
    console.log('initializeApp: Querying posts for user', session.user.id);
    const { data: postCount, error: countError } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', session.user.id)
      .gte('timestamp', `${today}T00:00:00Z`)
      .lte('timestamp', `${today}T23:59:59Z`);
    console.log('initializeApp: Post query response', { postCount: postCount?.length, error: countError?.message });

    if (countError) throw countError;

    state.postsLeft = 10 - (postCount?.length || 0);
    console.log('initializeApp: Posts left', state.postsLeft);
    $('#postsLeft').textContent = state.postsLeft;

    console.log('initializeApp: Calling fetchUserProfile');
    await fetchUserProfile();
    console.log('initializeApp: Calling initializeRealtime');
    initializeRealtime();
  } catch (error) {
    console.error('Error initializing app:', error.message, error.stack);
    const urlParams = new URLSearchParams(window.location.search);
    const redirectCount = parseInt(urlParams.get('redirectCount') || '0');
    if (redirectCount > 2) {
      showError('Redirect loop detected.');
      return;
    }
    window.location.href = `joinus.html?redirectCount=${redirectCount + 1}`;
  }
}
// Fetch user profile
async function fetchUserProfile() {
  try {
    showLoadingState();
    console.log('fetchUserProfile: Starting');
    
    let user = null;
    let error = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`fetchUserProfile: Attempt ${attempt}`);
      const { data: { user: fetchedUser }, error: fetchError } = await supabase.auth.getUser();
      console.log('fetchUserProfile: getUser response', { user: fetchedUser ? { id: fetchedUser.id, email: fetchedUser.email } : null, error: fetchError?.message });
      if (fetchError || !fetchedUser) {
        console.warn(`fetchUserProfile: Attempt ${attempt} failed`, fetchError?.message);
        error = fetchError;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      } else {
        user = fetchedUser;
        break;
      }
    }

    if (error || !user) {
      console.error('fetchUserProfile: Failed after retries', error?.message);
      const urlParams = new URLSearchParams(window.location.search);
      const redirectCount = parseInt(urlParams.get('redirectCount') || '0');
      if (redirectCount > 2) {
        showError('Redirect loop detected.');
        return;
      }
      window.location.href = `joinus.html?redirectCount=${redirectCount + 1}`;
      return;
    }

    const name = user.user_metadata?.full_name || user.email;
    const title = user.user_metadata?.title || 'Professional';
    const avatar = user.user_metadata?.avatar_url || generateAvatar(name);

    updateProfileUI({ name, title, avatar });
  } catch (error) {
    console.error('fetchUserProfile: Unexpected error', error.message, error.stack);
    throw error; // Rethrow to catch in initializeApp
  } finally {
    hideLoadingState();
  }
}
// Update profile UI
function updateProfileUI({ name, title, avatar }) {
  state.username = name;
  if ($('#sidebarName')) $('#sidebarName').textContent = name;
  if ($('#sidebarTitle')) $('#sidebarTitle').textContent = title;
  if ($('#sidebarAvatar img')) {
    $('#sidebarAvatar img').src = avatar;
    $('#sidebarAvatar img').alt = name;
  }
  if ($('.user-avatar')) {
    $('.user-avatar').src = avatar;
    $('.user-avatar').alt = name;
  }
  if ($('.composer-avatar')) {
    $('.composer-avatar').src = avatar;
    $('.composer-avatar').alt = name;
  }
  $$('.username').forEach((element) => {
    if (element.id !== 'sidebarName') element.textContent = name;
  });
}

// Generate fallback avatar
function generateAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=667eea&color=fff&size=80&font-size=0.6`;
}

// Show/hide loading state
function showLoadingState() {
  if ($('#sidebarName')) $('#sidebarName').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
  if ($('#sidebarTitle')) $('#sidebarTitle').textContent = 'Loading...';
}
function hideLoadingState() {}

// Real-time subscriptions
function initializeRealtime() {
  supabase
    .channel('posts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
      state.posts.unshift(payload.new);
      loadPosts();
      showSuccess('New post added!');
    })
    .subscribe();

  supabase
    .channel('comments')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
      const postElement = $(`#${payload.new.post_id}`);
      if (postElement) {
        toggleComments(postElement.querySelector('.action-btn i.fa-comment').parentElement);
      }
    })
    .subscribe();

  supabase
    .channel('notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${supabase.auth.getUser().then(({ data: { user } }) => user.id)}` }, (payload) => {
      state.notifications.push({
        id: payload.new.id,
        message: payload.new.message,
        time: payload.new.created_at,
        read: false,
      });
      $('.notification-badge').textContent = state.notifications.filter((n) => !n.read).length;
      showSuccess('New notification received!');
    })
    .subscribe();
}

// Show section
function showSection(sectionId, button = null) {
  $$('.section').forEach((section) => {
    section.classList.toggle('active', section.id === `${sectionId}-section`);
  });

  if (button) {
    $$('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn === button);
      btn.setAttribute('aria-selected', btn === button);
    });
  }

  state.activeSection = sectionId;

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
}

// Load posts
async function loadPosts() {
  try {
    const feedContainer = $('#feed-container');
    feedContainer.innerHTML = '';

    const { data: { user } } = await supabase.auth.getUser();
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;

    state.posts = posts;

    const { data: likedPosts } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id);

    const likedPostIds = likedPosts?.map((like) => like.post_id) || [];

    for (const post of posts) {
      const postElement = createPostElement(post);
      if (likedPostIds.includes(post.id)) {
        const likeBtn = postElement.querySelector('.action-btn i.fa-thumbs-up').parentElement;
        likeBtn.classList.add('active');
        likeBtn.querySelector('i').className = 'fas fa-thumbs-up';
      }
      feedContainer.appendChild(postElement);
    }

    $$('.action-btn').forEach((btn) => {
      if (btn.classList.contains('bookmark')) btn.addEventListener('click', toggleBookmark);
      if (btn.querySelector('i.fa-thumbs-up')) btn.addEventListener('click', toggleUpvote);
      if (btn.querySelector('i.fa-comment')) btn.addEventListener('click', toggleComments);
      if (btn.querySelector('i.fa-share')) btn.addEventListener('click', sharePost);
    });

    $$('.poll-option').forEach((option) => {
      option.addEventListener('click', votePoll);
    });
  } catch (error) {
    console.error('Error loading posts:', error);
    showError('Could not load posts.');
  }
}

// Create post
async function createPost(postData) {
  try {
    // Debug what we received
    console.log('createPost: Function called with arguments:', arguments.length);
    console.log('createPost: postData type:', typeof postData);
    console.log('createPost: postData value:', postData);
    console.log('createPost: postData stringified:', JSON.stringify(postData));
    
    // Input validation - check if postData exists
    if (!postData) {
      console.error('createPost: postData is falsy:', postData);
      throw new Error('postData is required');
    }
    
    if (typeof postData !== 'object') {
      console.error('createPost: postData is not an object, it is:', typeof postData);
      throw new Error('postData must be an object');
    }

    // Log function entry and input
    console.log('createPost: Starting', {
      postData: {
        user_id: postData.user_id,
        author: postData.author,
        content: postData.content,
        avatar: postData.avatar,
        tags: postData.tags,
        media: postData.media
      },
      timestamp: new Date().toISOString()
    });

    // Verify session before query
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('createPost: Session check', {
      user: session?.user?.email,
      userId: session?.user?.id,
      error: sessionError?.message
    });
    if (sessionError || !session || !session.user) {
      throw new Error(`No valid session: ${sessionError?.message || 'No session'}`);
    }

    // Validate required content
    if (!postData.content || typeof postData.content !== 'string' || postData.content.trim().length === 0) {
      throw new Error('Content is required and must be a non-empty string');
    }

    // Ensure postData has required fields
    const validatedPost = {
      user_id: session.user.id,
      author: postData.author || session.user.email,
      content: postData.content.trim(),
      avatar: postData.avatar || session.user.user_metadata?.avatar_url,
      media: postData.media || null,
      tags: Array.isArray(postData.tags) ? postData.tags : [],
      timestamp: new Date().toISOString()
    };
    console.log('createPost: Validated post data', validatedPost);

    if (!validatedPost.user_id || !validatedPost.author || !validatedPost.content) {
      throw new Error('Missing required fields: user_id, author, or content');
    }

    // Execute insert
    console.log('createPost: Sending insert query');
    console.log('createPost: Data being inserted:', JSON.stringify(validatedPost, null, 2));
    console.log('createPost: Supabase client status:', supabase ? 'Connected' : 'Not connected');
    
    const { data, error } = await supabase.from('posts').insert([validatedPost]).select();
    
    console.log('createPost: Raw Supabase response:', { data, error });
    console.log('createPost: Insert response details', {
      success: !error,
      dataCount: data ? data.length : 0,
      fullData: data,
      error: error ? { 
        message: error.message, 
        code: error.code, 
        details: error.details,
        hint: error.hint,
        fullError: error
      } : null
    });

    if (error) {
      console.error('createPost: Supabase error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        statusCode: error.statusCode,
        fullError: JSON.stringify(error, null, 2)
      });
      throw new Error(`Supabase insert failed: ${error.message} (code: ${error.code})`);
    }

    if (!data || data.length === 0) {
      console.error('createPost: No data returned from insert');
      console.error('createPost: This might indicate a permissions issue or the insert silently failed');
      throw new Error('Post creation failed: no data returned');
    }

    console.log('createPost: Success!', { 
      postId: data[0]?.id,
      insertedData: data[0],
      dataLength: data.length 
    });
    return data[0];
  } catch (error) {
    const errorInfo = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      code: error.code,
      details: error.details,
      timestamp: new Date().toISOString()
    };
    
    console.error('createPost: Error', errorInfo);
    console.error('createPost: Full error object:', error);
    
    throw error; // Rethrow for caller to handle
  }
}

// Extract tags
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
      mediaContent = `<img src="${post.media.url}" alt="Post image" class="post-media">`;
    } else if (post.media.type === 'link') {
      mediaContent = `<a href="${post.media.url}" target="_blank" class="post-link">${post.media.url}</a>`;
    } else if (post.media.type === 'document') {
      mediaContent = `<div class="post-document"><i class="fas fa-file"></i> ${post.media.name}</div>`;
    } else if (post.media.type === 'poll') {
      mediaContent = `
        <div class="post-poll">
          <h4>${post.media.question}</h4>
          ${post.media.options
            .map(
              (opt, idx) => `
                <div class="poll-option" data-poll-id="${post.media.pollId}" data-option-id="${idx}">
                  <span>${opt.text}</span>
                  <span class="poll-votes">${opt.votes} votes</span>
                  <div class="poll-progress" style="width: ${
                    post.media.totalVotes > 0 ? (opt.votes / post.media.totalVotes) * 100 : 0
                  }%"></div>
                </div>
              `
            )
            .join('')}
          <div class="poll-total">Total votes: ${post.media.totalVotes}</div>
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
        <span class="stat">0 comments</span>
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

// Format time
function formatTime(timestamp) {
  const now = new Date();
  const postTime = new Date(timestamp);
  const diff = (now - postTime) / 1000;

  if (diff < 60) return `${Math.floor(diff)} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

// Toggle upvote
async function toggleUpvote(button) {
  try {
    const postElement = button.closest('.post');
    const postId = postElement.id;
    const { data: { user } } = await supabase.auth.getUser();

    const { data: existingLike } = await supabase
      .from('likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();

    let newLikeCount = 0;

    if (existingLike) {
      await supabase.from('likes').delete().eq('id', existingLike.id);
      button.classList.remove('active');
      button.querySelector('i').className = 'far fa-thumbs-up';
    } else {
      await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
      button.classList.add('active');
      button.querySelector('i').className = 'fas fa-thumbs-up';
    }

    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    newLikeCount = count;

    const stat = postElement.querySelector('.engagement-stats .stat');
    stat.innerHTML = `<i class="fas fa-thumbs-up"></i> ${newLikeCount} likes`;
  } catch (error) {
    console.error('Error toggling like:', error);
    showError('Failed to update like.');
  }
}

// Toggle comments
async function toggleComments(button) {
  try {
    const postElement = button.closest('.post');
    const postId = postElement.id;
    let commentSection = postElement.querySelector('.comment-section');

    if (commentSection) {
      commentSection.classList.toggle('hidden');
      return;
    }

    commentSection = document.createElement('div');
    commentSection.className = 'comment-section';
    commentSection.innerHTML = `
      <div class="comments-list"></div>
      <div class="comment-input">
        <textarea class="comment-textarea" placeholder="Write a comment..."></textarea>
        <button class="submit-comment">Post</button>
      </div>
    `;
    postElement.appendChild(commentSection);

    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const commentsList = commentSection.querySelector('.comments-list');
    comments.forEach((comment) => {
      const commentItem = document.createElement('div');
      commentItem.className = 'comment-item';
      commentItem.innerHTML = `
        <div class="comment-author">${comment.author}</div>
        <p>${comment.content}</p>
        <span class="comment-time">${formatTime(comment.created_at)}</span>
      `;
      commentsList.appendChild(commentItem);
    });

    commentSection.querySelector('.submit-comment').addEventListener('click', () => submitComment(commentSection.querySelector('.submit-comment')));
  } catch (error) {
    console.error('Error toggling comments:', error);
    showError('Failed to load comments.');
  }
}

// Submit comment
async function submitComment(button) {
  try {
    const postElement = button.closest('.post');
    const postId = postElement.id;
    const textarea = postElement.querySelector('.comment-textarea');
    const content = DOMPurify.sanitize(textarea.value.trim());

    if (!content) {
      showError('Comment cannot be empty.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const comment = {
      post_id: postId,
      user_id: user.id,
      author: user.raw_user_meta_data?.full_name || user.email,
      content,
    };

    const { error } = await supabase.from('comments').insert([comment]);
    if (error) throw error;

    textarea.value = '';
    showSuccess('Comment posted!');
    await toggleComments(postElement.querySelector('.action-btn i.fa-comment').parentElement);
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

// Handle media action
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
  }
}

// Add image
async function addImage() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) {
        showError('No image selected.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showError('Image size exceeds 5MB.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `media/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
      state.attachedMedia = { type: 'image', url: publicUrl };
      const preview = $('.composer-media-preview') || document.createElement('div');
      preview.className = 'composer-media-preview';
      preview.innerHTML = `<img src="${publicUrl}" alt="Image preview">`;
      $('.post-composer').insertBefore(preview, $('.composer-actions'));
      showSuccess('Image uploaded successfully!');
    });

    input.click();
    document.body.removeChild(input);
  } catch (error) {
    console.error('Error uploading image:', error);
    showError('Failed to upload image.');
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
    preview.innerHTML = `<a href="${state.attachedMedia.url}" target="_blank" class="post-link">${state.attachedMedia.url}</a>`;
    $('.post-composer').insertBefore(preview, $('.composer-actions'));
    showSuccess('Link attached successfully!');
  } catch (error) {
    console.error('Error adding link:', error);
    showError('Failed to attach link.');
  }
}

// Add document
async function addDocument() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) {
        showError('No document selected.');
        return;
      }

      if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
        showError('Please select a valid document (PDF, DOC, DOCX).');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        showError('Document size exceeds 10MB.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `media/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
      state.attachedMedia = { type: 'document', name: file.name, url: publicUrl };
      const preview = $('.composer-media-preview') || document.createElement('div');
      preview.className = 'composer-media-preview';
      preview.innerHTML = `<div class="post-document"><i class="fas fa-file"></i> ${file.name}</div>`;
      $('.post-composer').insertBefore(preview, $('.composer-actions'));
      showSuccess('Document uploaded successfully!');
    });

    input.click();
    document.body.removeChild(input);
  } catch (error) {
    console.error('Error uploading document:', error);
    showError('Failed to upload document.');
  }
}

// Create poll
async function createPoll() {
  try {
    const modal = document.createElement('div');
    modal.className = 'poll-modal';
    modal.innerHTML = `
      <div class="poll-form">
        <h3>Create a Poll</h3>
        <input type="text" id="pollQuestion" placeholder="Enter your question">
        <div id="pollOptions">
          <input type="text" class="poll-option-input" placeholder="Option 1">
          <input type="text" class="poll-option-input" placeholder="Option 2">
        </div>
        <button class="add-option">+ Add Option</button>
        <div class="poll-actions">
          <button class="submit-poll">Create Poll</button>
          <button class="cancel-poll">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.add-option').addEventListener('click', () => {
      const optionInput = document.createElement('input');
      optionInput.type = 'text';
      optionInput.className = 'poll-option-input';
      optionInput.placeholder = `Option ${modal.querySelectorAll('.poll-option-input').length + 1}`;
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

      state.attachedMedia = {
        type: 'poll',
        question,
        options: options.map((text) => ({ text, votes: 0 })),
        totalVotes: 0,
      };

      const preview = $('.composer-media-preview') || document.createElement('div');
      preview.className = 'composer-media-preview';
      preview.innerHTML = `<div class="poll-preview"><h4>${question}</h4>${options.map((opt) => `<p>${opt}</p>`).join('')}</div>`;
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

// Vote poll
async function votePoll(event) {
  try {
    const optionElement = event.currentTarget;
    const pollId = optionElement.dataset.pollId;
    const optionId = parseInt(optionElement.dataset.optionId);

    const { data: poll, error: fetchError } = await supabase
      .from('polls')
      .select('*')
      .eq('id', pollId)
      .single();

    if (fetchError) throw fetchError;

    poll.options[optionId].votes++;
    poll.total_votes++;

    const { error: updateError } = await supabase
      .from('polls')
      .update({ options: poll.options, total_votes: poll.total_votes })
      .eq('id', pollId);

    if (updateError) throw updateError;

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
                poll.total_votes > 0 ? (opt.votes / poll.total_votes) * 100 : 0
              }%"></div>
            </div>
          `
        )
        .join('')}
      <div class="poll-total">Total votes: ${poll.total_votes}</div>
    `;
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
    modal.innerHTML = `
      <div class="notification-list">
        <h3>Notifications</h3>
        <div id="notificationItems">
          ${state.notifications
            .map(
              (notif) => `
                <div class="notification-item" style="${notif.read ? '' : 'background: var(--bg-glass-hover);'}">
                  <p>${notif.message}</p>
                  <span>${formatTime(notif.time)}</span>
                </div>
              `
            )
            .join('')}
        </div>
        <button class="close-notifications">Close</button>
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
    modal.innerHTML = `
      <div class="messages-list">
        <h3>Messages</h3>
        <div id="messageItems">
          ${state.messages
            .map(
              (msg) => `
                <div class="message-item">
                  <div class="message-sender">${msg.sender}</div>
                  <p>${msg.content}</p>
                  <span>${formatTime(msg.time)}</span>
                </div>
              `
            )
            .join('')}
        </div>
        <div class="message-input">
          <textarea class="message-textarea" placeholder="Type a message..."></textarea>
          <button class="send-message">Send</button>
        </div>
        <button class="close-messages">Close</button>
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
      messageItem.innerHTML = `
        <div class="message-sender">${$('#sidebarName').textContent}</div>
        <p>${content}</p>
        <span>${formatTime(new Date().toISOString())}</span>
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

// Load profile
async function loadProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const name = user.raw_user_meta_data?.full_name || user.email;
    const title = user.raw_user_meta_data?.title || 'Professional';
    const avatar = user.raw_user_meta_data?.avatar_url || generateAvatar(name);
    const bio = user.raw_user_meta_data?.bio || 'No bio provided.';

    $('#contentArea').innerHTML = `
      <div class="section active" id="profile-section">
        <h2>${name}'s Profile</h2>
        <img src="${avatar}" alt="Profile" class="profile-image">
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Bio:</strong> ${bio}</p>
        <button class="edit-profile">Edit Profile</button>
      </div>
    `;

    $('.edit-profile').addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'profile-modal';
      modal.innerHTML = `
        <div class="profile-form">
          <h3>Edit Profile</h3>
          <input type="text" id="editFullName" value="${name}" placeholder="Full Name">
          <input type="text" id="editTitle" value="${title}" placeholder="Title">
          <textarea id="editBio" placeholder="Bio">${bio}</textarea>
          <input type="file" id="editAvatar" accept="image/*">
          <div class="profile-actions">
            <button class="save-profile">Save</button>
            <button class="cancel-profile">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('.save-profile').addEventListener('click', async () => {
        const fullName = DOMPurify.sanitize($('#editFullName').value.trim());
        const title = DOMPurify.sanitize($('#editTitle').value.trim());
        const bio = DOMPurify.sanitize($('#editBio').value.trim());
        const avatarFile = $('#editAvatar').files[0];

        let avatarUrl = user.raw_user_meta_data?.avatar_url || generateAvatar(fullName);
        if (avatarFile) {
          const filePath = `avatars/${user.id}/${Date.now()}_${avatarFile.name}`;
          const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile);
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
          avatarUrl = publicUrl;
        }

        const { error } = await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            title,
            bio,
            avatar_url: avatarUrl,
          },
        });
        if (error) throw error;

        document.body.removeChild(modal);
        showSuccess('Profile updated!');
        fetchUserProfile();
        loadProfile();
      });

      modal.querySelector('.cancel-profile').addEventListener('click', () => {
        document.body.removeChild(modal);
      });
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    showError('Failed to load profile.');
  }
}

// Load Career AI
async function loadCareerAI() {
  try {
    const jobs = [
      { title: 'Senior Frontend Developer', company: 'Google', match: '95%', salary: '$120k - $180k' },
      { title: 'Full Stack Engineer', company: 'Microsoft', match: '88%', salary: '$110k - $160k' },
    ];

    $('#contentArea').innerHTML = `
      <div class="section active" id="career-section">
        <h2>Career AI Recommendations</h2>
        <div class="job-recommendations">
          ${jobs
            .map(
              (job) => `
                <div class="job-item">
                  <h4>${job.title}</h4>
                  <p>${job.company}</p>
                  <p>${job.match} match | ${job.salary}</p>
                </div>
              `
            )
            .join('')}u
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading Career AI:', error);
    showError('Failed to load Career AI.');
  }
}

// Load CV Parser
async function loadCVParser() {
  try {
    $('#contentArea').innerHTML = `
      <div class="section active" id="cv-section">
        <h2>CV Parser</h2>
        <input type="file" id="cvUpload" accept=".pdf">
        <button class="parse-cv">Parse CV</button>
        <div id="cvOutput"></div>
      </div>
    `;

    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

    $('.parse-cv').addEventListener('click', async () => {
      const file = $('#cvUpload').files[0];
      if (!file) {
        showError('Please upload a PDF file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const pdf = await pdfjsLib.getDocument(e.target.result).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(' ') + '\n';
        }

        const { data: { user } } = await supabase.auth.getUser();
        const filePath = `cvs/${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('cvs').upload(filePath, file);
        if (uploadError) throw uploadError;

        $('#cvOutput').innerHTML = `<pre>${text}</pre>`;
        showSuccess('CV parsed successfully!');
      };
      reader.readAsArrayBuffer(file);
    });
  } catch (error) {
    console.error('Error loading CV parser:', error);
    showError('Failed to load CV parser.');
  }
}

// Load Communities
async function loadCommunities() {
  try {
    const { data: communities, error } = await supabase
      .from('communities')
      .select('id, name, icon, members');
    if (error) throw error;

    $('#contentArea').innerHTML = `
      <div class="section active" id="communities-section">
        <h2>My Communities</h2>
        <div class="communities-list">
          ${communities
            .map(
              (community) => `
                <div class="community-item">
                  <i class="${community.icon || 'fas fa-users'}"></i>
                  <h4>${community.name}</h4>
                  <p>${community.members} members</p>
                </div>
              `
            )
            .join('')}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading communities:', error);
    showError('Failed to load communities.');
  }
}

// Update post limit
function updatePostLimit() {
  const content = $('#postContent').value;
  const remaining = 280 - content.length;
  $('.post-limit').textContent = `${remaining} characters remaining`;
}

// Show error
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => {
    errorDiv.style.opacity = '0';
    setTimeout(() => errorDiv.remove(), 300);
  }, 3000);
}

// Show success
function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;
  document.body.appendChild(successDiv);
  setTimeout(() => {
    successDiv.style.opacity = '0';
    setTimeout(() => successDiv.remove(), 300);
  }, 3000);
}

// Debounce
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

// Toggle user menu
function toggleUserMenu() {
  const dropdown = $('#userMenuDropdown');
  dropdown.classList.toggle('show');
}

// Sign out
async function signOut() {
  if (confirm('Are you sure you want to sign out?')) {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      localStorage.removeItem('user');
      sessionStorage.clear();
      window.location.href = 'joinus.html';
    } catch (error) {
      console.error('Error signing out:', error);
      showError('Failed to sign out.');
    }
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  $('#postContent').addEventListener('input', debounce(updatePostLimit, 200));
  document.addEventListener('click', (event) => {
    const userMenu = $('.user-menu');
    const dropdown = $('#userMenuDropdown');
    if (!userMenu.contains(event.target)) {
      dropdown.classList.remove('show');
    }
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = 'joinus.html';
    }
  });
});