// Enhanced Authentication System
// ============================================================================
console.log('auth.js: Script loaded');

// Supabase client initialization
let supabase;
try {
  supabase = window.supabase.createClient(
    'https://lhcneterxhyctrksvloe.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoY25ldGVyeGh5Y3Rya3N2bG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjEyOTQsImV4cCI6MjA2NDU5NzI5NH0.7V0lgM3YGObRRSWe5YPXxO49KyoMxwFnQMBhmU8uCHE'
  );
  console.log('auth.js: Supabase client initialized');
} catch (error) {
  console.error('auth.js: Supabase initialization failed:', error);
  setStatus('Failed to connect to authentication service.', 'error');
}

// DOM Elements
const elements = {
  emailInput: document.getElementById('email'),
  passwordInput: document.getElementById('password'),
  signUpBtn: document.getElementById('signUpBtn'),
  signInBtn: document.getElementById('signInBtn'),
  statusMessage: document.getElementById('status-message'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  authForm: document.getElementById('auth-form'),
  modeText: document.getElementById('mode-text'),
  modeLink: document.getElementById('mode-link'),
  nameInput: document.getElementById('fullName'),
  nameGroup: document.getElementById('name-group'),
  forgotPasswordLink: document.getElementById('forgot-password'),
  formSubtitle: document.getElementById('form-subtitle')
};

// Validate DOM elements
for (const [key, value] of Object.entries(elements)) {
  if (!value) {
    console.error(`auth.js: DOM element '${key}' not found`);
    setStatus('Page failed to load properly. Please refresh.', 'error');
  }
}

let isSignUpMode = false;
let currentUser = null;
let profileModal = null;
let redirectTimeout = null;
let userHasInteracted = false;

// ============================================================================
// PROFILE SETUP MODAL CLASS
// ============================================================================

class ProfileSetupModal {
  constructor(isMandatory = false) {
    console.log('auth.js: Creating ProfileSetupModal, isMandatory:', isMandatory);
    this.modalElement = null;
    this.isMandatory = isMandatory;
    this.create();
  }

  create() {
    try {
      const modalHTML = `
        <div id="profile-setup-modal" class="profile-modal-overlay" style="display: none;">
          <div class="profile-modal-content">
            <div class="profile-modal-header">
              <h2>Complete Your Profile</h2>
              <p>Help others discover you by completing your profile</p>
            </div>
            <form id="profile-setup-form" class="profile-modal-form">
              <div class="profile-form-group">
                <label for="profile-avatar">Profile Picture</label>
                <input type="file" id="profile-avatar" accept="image/*">
                <p class="form-hint">Optional: Upload a profile picture (max 2MB)</p>
              </div>
              <div class="profile-form-group">
                <label for="profile-job-title">Job Title *</label>
                <input type="text" id="profile-job-title" placeholder="e.g., Software Engineer" required>
              </div>
              <div class="profile-form-group">
                <label for="profile-location">Location</label>
                <input type="text" id="profile-location" placeholder="e.g., New York, NY">
              </div>
              <div class="profile-form-group">
                <label for="profile-bio">Bio</label>
                <textarea id="profile-bio" placeholder="Tell us about yourself..." rows="3"></textarea>
              </div>
              <div class="profile-form-group">
                <label for="profile-skills">Skills (comma separated)</label>
                <input type="text" id="profile-skills" placeholder="e.g., JavaScript, React, Node.js">
              </div>
              <div class="profile-form-group">
                <label for="profile-website">Website/Portfolio</label>
                <input type="url" id="profile-website" placeholder="https://yourwebsite.com">
              </div>
              <div class="profile-modal-actions">
                ${this.isMandatory ? '' : '<button type="button" id="skip-profile-setup" class="btn btn-secondary">Skip for now</button>'}
                <button type="submit" class="btn btn-primary">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      this.addModalStyles();
      this.setupEventListeners();
      console.log('auth.js: Profile modal created');
    } catch (error) {
      console.error('auth.js: Error creating profile modal:', error);
      setStatus('Failed to initialize profile setup.', 'error');
    }
  }

  addModalStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .profile-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(5px); }
      .profile-modal-content { background: white; padding: 2rem; border-radius: 12px; width: 90%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3); animation: modalSlideIn 0.3s ease-out; }
      @keyframes modalSlideIn { from { opacity: 0; transform: translateY(-30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .profile-modal-header { text-align: center; margin-bottom: 2rem; }
      .profile-modal-header h2 { color: #1a1a1a; margin-bottom: 0.5rem; font-size: 1.5rem; }
      .profile-modal-header p { color: #666; font-size: 0.95rem; }
      .profile-form-group { margin-bottom: 1.5rem; }
      .profile-form-group label { display: block; margin-bottom: 0.5rem; color: #333; font-weight: 500; font-size: 0.9rem; }
      .profile-form-group input, .profile-form-group textarea { width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 0.95rem; transition: border-color 0.3s ease; box-sizing: border-box; }
      .profile-form-group input[type="file"] { border: none; padding: 0; }
      .profile-form-group input:focus, .profile-form-group textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
      .profile-form-group textarea { resize: vertical; min-height: 80px; }
      .form-hint { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }
      .profile-modal-actions { display: flex; gap: 1rem; margin-top: 2rem; }
      .profile-modal-actions .btn { flex: 1; padding: 0.75rem 1.5rem; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 500; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; }
      .profile-modal-actions .btn-primary { background: #4f46e5; color: white; }
      .profile-modal-actions .btn-primary:hover { background: #4338ca; transform: translateY(-1px); }
      .profile-modal-actions .btn-secondary { background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db; }
      .profile-modal-actions .btn-secondary:hover { background: #e5e7eb; }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    const form = document.getElementById('profile-setup-form');
    const skipBtn = document.getElementById('skip-profile-setup');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('auth.js: Profile form submitted');
        this.handleSubmit();
      });
    } else {
      console.error('auth.js: Profile setup form not found');
    }

    if (skipBtn && !this.isMandatory) {
      skipBtn.addEventListener('click', () => {
        console.log('auth.js: Skip profile setup clicked');
        this.hide();
        redirectToDashboard();
      });
    }

    const modal = document.getElementById('profile-setup-modal');
    if (modal && !this.isMandatory) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          console.log('auth.js: Modal overlay clicked');
          this.hide();
        }
      });
    }
  }

  async handleSubmit() {
    console.log('auth.js: Handling profile submit');
    if (!currentUser) {
      setStatus('User not found. Please try again.', 'error');
      return;
    }

    const jobTitle = document.getElementById('profile-job-title')?.value.trim();
    const location = document.getElementById('profile-location')?.value.trim();
    const bio = document.getElementById('profile-bio')?.value.trim();
    const skillsInput = document.getElementById('profile-skills')?.value.trim();
    const website = document.getElementById('profile-website')?.value.trim();
    const avatarInput = document.getElementById('profile-avatar');

    if (!jobTitle) {
      setStatus('Job title is required.', 'error');
      return;
    }

    showLoading('Updating your profile...');

    try {
      let avatarUrl = null;
      if (avatarInput?.files[0]) {
        const file = avatarInput.files[0];
        if (file.size > 2 * 1024 * 1024) {
          throw new Error('Image size must be less than 2MB');
        }
        const filePath = `avatars/${currentUser.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);
        if (uploadError) {
          throw uploadError;
        }
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);
        avatarUrl = publicUrlData.publicUrl;
        console.log('auth.js: Avatar uploaded, URL:', avatarUrl);
      }

      const skills = skillsInput 
        ? skillsInput.split(',').map(skill => skill.trim()).filter(skill => skill)
        : [];
      const fields = [jobTitle, location, bio, skillsInput, website, avatarUrl];
      const completedFields = fields.filter(field => field && field.trim()).length;
      const profileCompleteness = Math.round((completedFields / fields.length) * 100);

      const { error } = await supabase
        .from('profiles')
        .update({
          job_title: jobTitle,
          location: location || null,
          bio: bio || null,
          skills: skills.length > 0 ? skills : null,
          website: website || null,
          avatar_url: avatarUrl,
          profile_completeness: profileCompleteness,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) {
        throw error;
      }

      console.log('auth.js: Profile updated successfully');
      setStatus('Profile updated successfully!', 'success');
      this.hide();
      redirectToDashboard();
    } catch (error) {
      console.error('auth.js: Error updating profile:', error);
      setStatus(`Failed to update profile: ${error.message}`, 'error');
    } finally {
      hideLoading();
    }
  }

  show() {
    console.log('auth.js: Showing profile modal');
    const modal = document.getElementById('profile-setup-modal');
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        const firstInput = document.getElementById('profile-job-title');
        if (firstInput) firstInput.focus();
      }, 100);
    } else {
      console.error('auth.js: Profile modal not found');
    }
  }

  hide() {
    console.log('auth.js: Hiding profile modal');
    const modal = document.getElementById('profile-setup-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
}

// ============================================================================
// UI UTILITY FUNCTIONS
// ============================================================================

function setStatus(message, type = 'info', duration = 5000) {
  console.log(`auth.js: Setting status - ${type}: ${message}`);
  if (elements.statusMessage) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message show status-${type}`;
    setTimeout(() => {
      elements.statusMessage.classList.remove('show');
    }, duration);
  } else {
    console.error('auth.js: Status message element not found');
    alert(message);
  }
}

function showLoading(text = 'Processing...') {
  console.log('auth.js: Showing loading overlay:', text);
  if (elements.loadingText && elements.loadingOverlay) {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.classList.add('show');
  } else {
    console.error('auth.js: Loading elements not found');
  }
}

function hideLoading() {
  console.log('auth.js: Hiding loading overlay');
  if (elements.loadingOverlay) {
    elements.loadingOverlay.classList.remove('show');
  }
}

function redirectToDashboard() {
  console.log('auth.js: Redirecting to dashboard');
  if (redirectTimeout) {
    clearTimeout(redirectTimeout);
  }
  
  setStatus('Redirecting to dashboard...', 'success');
  redirectTimeout = setTimeout(() => {
    try {
      console.log('auth.js: Executing redirect to dashboard.html');
      window.location.href = 'dashboard.html';
    } catch (error) {
      console.error('auth.js: Redirect failed:', error);
      setStatus('Failed to redirect to dashboard.', 'error');
    }
  }, 1500);
}

function toggleMode() {
  console.log('auth.js: Toggling mode, isSignUpMode:', !isSignUpMode);
  isSignUpMode = !isSignUpMode;

  if (isSignUpMode) {
    elements.signInBtn.style.display = 'none';
    elements.signUpBtn.style.display = 'inline-block';
    elements.modeText.textContent = 'Already have an account? ';
    elements.modeLink.textContent = 'Sign in';
    elements.formSubtitle.textContent = 'Create your account';
    elements.nameGroup.style.display = 'block';
    elements.forgotPasswordLink.style.display = 'none';
  } else {
    elements.signInBtn.style.display = 'inline-block';
    elements.signUpBtn.style.display = 'none';
    elements.modeText.textContent = "Don't have an account? ";
    elements.modeLink.textContent = 'Create one';
    elements.formSubtitle.textContent = 'Sign in to your account';
    elements.nameGroup.style.display = 'none';
    elements.forgotPasswordLink.style.display = 'block';
  }
}

function validateInputs(email, password, fullName = '') {
  console.log('auth.js: Validating inputs:', { email, password, fullName });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    setStatus('Please enter a valid email address.', 'error');
    return false;
  }
  if (!password || password.length < 6) {
    setStatus('Password must be at least 6 characters long.', 'error');
    return false;
  }
  if (isSignUpMode && !fullName) {
    setStatus('Please enter your full name.', 'error');
    return false;
  }
  return true;
}

function disableButtons(disabled) {
  console.log('auth.js: Setting buttons disabled:', disabled);
  if (elements.signUpBtn) elements.signUpBtn.disabled = disabled;
  if (elements.signInBtn) elements.signInBtn.disabled = disabled;
}

// ============================================================================
// PROFILE MANAGEMENT FUNCTIONS
// ============================================================================

async function checkProfileCompleteness(userId) {
  console.log('auth.js: Checking profile completeness for user:', userId);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('job_title, profile_completeness')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('auth.js: Error checking profile:', error);
      return false;
    }

    const isComplete = data && data.job_title && data.job_title.trim() !== '';
    console.log('auth.js: Profile complete:', isComplete);
    return isComplete;
  } catch (error) {
    console.error('auth.js: Error in checkProfileCompleteness:', error);
    setStatus('Error checking profile. Please try again.', 'error');
    return false;
  }
}

async function insertProfileIfNeeded(user) {
  console.log('auth.js: Inserting profile if needed for user:', user.id);
  try {
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (fetchError && fetchError.code === 'PGRST116') {
      const fullName = user.user_metadata?.full_name || 
                      localStorage.getItem('pendingFullName') || 
                      'New User';

      const { error: insertError } = await supabase.from('profiles').insert([
        {
          id: user.id,
          email: user.email,
          full_name: fullName,
          profile_completeness: 25
        }
      ]);

      if (insertError) {
        throw insertError;
      }
      console.log('auth.js: Profile inserted successfully');
      localStorage.removeItem('pendingFullName');
    } else if (existingProfile) {
      console.log('auth.js: Profile already exists');
    }
  } catch (error) {
    console.error('auth.js: Error in insertProfileIfNeeded:', error);
    setStatus('Error creating profile. Please try again.', 'error');
    throw error;
  }
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

async function forgotPassword() {
  console.log('auth.js: Forgot password link clicked');
  userHasInteracted = true;
  if (!elements.emailInput) {
    console.error('auth.js: Email input missing');
    setStatus('Form elements not found.', 'error');
    return;
  }

  const email = elements.emailInput.value.trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    setStatus('Please enter a valid email address.', 'error');
    return;
  }

  showLoading('Sending password reset email...');

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`
    });

    if (error) {
      throw error;
    }

    console.log('auth.js: Password reset email sent');
    setStatus('Password reset email sent! Check your inbox.', 'success', 8000);
    elements.emailInput.value = '';
  } catch (error) {
    console.error('auth.js: Forgot password error:', error);
    setStatus(`Failed to send reset email: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

async function signUp() {
  console.log('auth.js: SignUp button clicked');
  userHasInteracted = true;
  if (!elements.emailInput || !elements.passwordInput || !elements.nameInput) {
    console.error('auth.js: Input elements missing');
    setStatus('Form elements not found.', 'error');
    return;
  }

  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;
  const fullName = elements.nameInput.value.trim();

  if (!validateInputs(email, password, fullName)) {
    return;
  }

  disableButtons(true);
  showLoading('Creating your account...');

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName }
      }
    });

    if (error) {
      throw error;
    }

    console.log('auth.js: SignUp response:', data);
    if (data.user && !data.user.email_confirmed_at) {
      setStatus('Account created! Please check your email to confirm.', 'success', 8000);
      elements.emailInput.value = '';
      elements.passwordInput.value = '';
      elements.nameInput.value = '';
    } else {
      localStorage.setItem('pendingFullName', fullName);
      currentUser = data.user;
      await insertProfileIfNeeded(data.user);
      profileModal = new ProfileSetupModal(true);
      setTimeout(() => {
        console.log('auth.js: Showing mandatory profile modal for sign-up');
        profileModal.show();
      }, 1000);
    }
  } catch (error) {
    console.error('auth.js: SignUp error:', error);
    setStatus(`Sign up failed: ${error.message}`, 'error');
  } finally {
    disableButtons(false);
    hideLoading();
  }
}

async function signIn() {
  console.log('auth.js: SignIn button clicked');
  userHasInteracted = true;
  if (!elements.emailInput || !elements.passwordInput) {
    console.error('auth.js: Input elements missing');
    setStatus('Form elements not found.', 'error');
    return;
  }

  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  if (!validateInputs(email, password)) {
    return;
  }
  
  disableButtons(true);
  showLoading('Signing you in...');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }

    console.log('auth.js: SignIn response:', data);
    setStatus('Successfully signed in!', 'success');
    currentUser = data.user;
    await handleAuthStateChange('SIGNED_IN', data.session);
  } catch (error) {
    console.error('auth.js: SignIn error:', error);
    setStatus(`Sign in failed: ${error.message}`, 'error');
  } finally {
    hideLoading();
    disableButtons(false);
  }
}

// ============================================================================
// AUTHENTICATION STATE HANDLER
// ============================================================================

async function handleAuthStateChange(event, session) {
  console.log('auth.js: Auth state changed:', event, session?.user?.email || 'No user');

  if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
    console.log('auth.js: Processing SIGNED_IN or INITIAL_SESSION event for user:', session?.user?.id);
    if (session && session.user) {
      currentUser = session.user;
      try {
        showLoading('Setting up your profile...');
        await insertProfileIfNeeded(session.user);
        console.log('auth.js: Profile check completed');
        
        const isProfileComplete = await checkProfileCompleteness(session.user.id);
        console.log('auth.js: Profile completeness check result:', isProfileComplete);

        if (!isProfileComplete && !isSignUpMode) {
          console.log('auth.js: Showing optional profile modal for sign-in');
          profileModal = new ProfileSetupModal(false);
          setTimeout(() => profileModal.show(), 1000);
        } else {
          console.log('auth.js: Profile complete or sign-up mode, redirecting');
          redirectToDashboard();
        }
      } catch (error) {
        console.error('auth.js: Error in post-login setup:', error);
        setStatus(`Error setting up profile: ${error.message}`, 'error');
      } finally {
        hideLoading();
      }
    } else {
      console.log('auth.js: No user in session, showing sign-in form');
      if (elements.authForm) elements.authForm.style.display = 'block';
      setStatus('Please sign in to continue.', 'info');
    }
  } else if (event === 'SIGNED_OUT') {
    console.log('auth.js: User signed out');
    currentUser = null;
    userHasInteracted = false;
    if (elements.authForm) elements.authForm.style.display = 'block';
    setStatus('You have been signed out.', 'info');
    hideLoading();
    disableButtons(false);
    
    if (redirectTimeout) {
      clearTimeout(redirectTimeout);
      redirectTimeout = null;
    }
  } else {
    console.log('auth.js: Unhandled auth event:', event);
  }
}
// ============================================================================
// EVENT LISTENERS
// ============================================================================

if (elements.modeLink) {
  elements.modeLink.addEventListener('click', (e) => {
    console.log('auth.js: Mode toggle clicked');
    e.preventDefault();
    toggleMode();
  });
}

if (elements.signInBtn) {
  elements.signInBtn.addEventListener('click', (e) => {
    console.log('auth.js: SignIn button event listener triggered');
    e.preventDefault();
    signIn();
  });
}

if (elements.signUpBtn) {
  elements.signUpBtn.addEventListener('click', (e) => {
    console.log('auth.js: SignUp button event listener triggered');
    e.preventDefault();
    signUp();
  });
}

if (elements.forgotPasswordLink) {
  elements.forgotPasswordLink.addEventListener('click', (e) => {
    console.log('auth.js: Forgot password link event listener triggered');
    e.preventDefault();
    forgotPassword();
  });
}

[elements.emailInput, elements.passwordInput, elements.nameInput].forEach(input => {
  if (input) {
    input.addEventListener('keypress', (e) => {
      console.log('auth.js: Keypress on input:', e.target.id);
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isSignUpMode) {
          signUp();
        } else {
          signIn();
        }
      }
    });
  }
});

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('auth.js: DOM fully loaded');
  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('auth.js: Error fetching initial session:', error);
      throw error;
    }
    console.log('auth.js: Initial session:', session?.user?.email || 'No session');
    
    if (session) {
      await handleAuthStateChange('SIGNED_IN', session);
    } else {
      if (elements.authForm) elements.authForm.style.display = 'block';
      setStatus('Please sign in to continue.', 'info');
    }
  } catch (error) {
    console.error('auth.js: Initialization error:', error);
    setStatus(`Initialization failed: ${error.message}`, 'error');
    if (elements.authForm) elements.authForm.style.display = 'block';
  }
});