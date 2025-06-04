const supabase = window.supabase.createClient(
      'https://lhcneterxhyctrksvloe.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoY25ldGVyeGh5Y3Rya3N2bG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjEyOTQsImV4cCI6MjA2NDU5NzI5NH0.7V0lgM3YGObRRSWe5YPXxO49KyoMxwFnQMBhmU8uCHE'
    );

    // DOM Elements
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const signUpBtn = document.getElementById('signUpBtn');
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const statusMessage = document.getElementById('status-message');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const authForm = document.getElementById('auth-form');
    const signedInState = document.getElementById('signed-in-state');
    const userEmail = document.getElementById('user-email');
    const modeText = document.getElementById('mode-text');
    const modeLink = document.getElementById('mode-link');

    let isSignUpMode = false;

    // UI State Management
    function setStatus(message, type = 'info', duration = 5000) {
      statusMessage.textContent = message;
      statusMessage.className = `status-message show status-${type}`;
      
      setTimeout(() => {
        statusMessage.classList.remove('show');
      }, duration);
    }

    function showLoading(text = 'Processing...') {
      loadingText.textContent = text;
      loadingOverlay.classList.add('show');
    }

    function hideLoading() {
      loadingOverlay.classList.remove('show');
    }

    function toggleMode() {
      isSignUpMode = !isSignUpMode;
      
      if (isSignUpMode) {
        signInBtn.style.display = 'none';
        signUpBtn.style.display = 'flex';
        modeText.textContent = 'Already have an account? ';
        modeLink.textContent = 'Sign in';
        document.querySelector('.subtitle').textContent = 'Create your account';
      } else {
        signInBtn.style.display = 'flex';
        signUpBtn.style.display = 'none';
        modeText.textContent = "Don't have an account? ";
        modeLink.textContent = 'Create one';
        document.querySelector('.subtitle').textContent = 'Sign in to your account';
      }
    }

    function showSignedInState(session) {
      authForm.style.display = 'none';
      signedInState.style.display = 'block';
      userEmail.textContent = session.user.email;
    }

    function showAuthForm() {
      authForm.style.display = 'block';
      signedInState.style.display = 'none';
    }

    function validateInputs(email, password) {
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        setStatus('Please enter a valid email address.', 'error');
        return false;
      }
      if (!password || password.length < 6) {
        setStatus('Password must be at least 6 characters long.', 'error');
        return false;
      }
      return true;
    }

    function disableButtons(disabled) {
      signUpBtn.disabled = disabled;
      signInBtn.disabled = disabled;
      signOutBtn.disabled = disabled;
    }

    // Authentication Functions
    async function signUp() {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!validateInputs(email, password)) return;
      
      disableButtons(true);
      showLoading('Creating your account...');

      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        });

        if (error) {
          setStatus(`Sign up failed: ${error.message}`, 'error');
        } else {
          setStatus('Account created! Please check your email to confirm your sign-up.', 'success', 8000);
          emailInput.value = '';
          passwordInput.value = '';
        }
      } catch (err) {
        setStatus('An unexpected error occurred. Please try again.', 'error');
      } finally {
        disableButtons(false);
        hideLoading();
      }
    }

    async function signIn() {
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!validateInputs(email, password)) return;
      
      disableButtons(true);
      showLoading('Signing you in...');

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          setStatus(`Sign in failed: ${error.message}`, 'error');
        } else {
          setStatus('Successfully signed in! Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 1500);
        }
      } catch (err) {
        setStatus('An unexpected error occurred. Please try again.', 'error');
      } finally {
        disableButtons(false);
        hideLoading();
      }
    }

   /* async function signOut() {
      disableButtons(true);
      showLoading('Signing you out...');

      try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          setStatus(`Sign out failed: ${error.message}`, 'error');
        } else {
          setStatus('Successfully signed out.', 'success');
          showAuthForm();
        }
      } catch (err) {
        setStatus('An unexpected error occurred. Please try again.', 'error');
      } finally {
        disableButtons(false);
        hideLoading();
      }
    }
*/
    // Event Listeners
    modeLink.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMode();
    });

    signInBtn.addEventListener('click', signIn);
    signUpBtn.addEventListener('click', signUp);
    signOutBtn.addEventListener('click', signOut);

    // Enter key support
    [emailInput, passwordInput].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          if (isSignUpMode) {
            signUp();
          } else {
            signIn();
          }
        }
      });
    });

    // Initialize Auth State
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        showSignedInState(session);
        setStatus(`Welcome back, ${session.user.email}!`, 'success');
      } else {
        showAuthForm();
        setStatus('Please sign in to continue.', 'info');
      }
    });

     // Auth State Listener
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        showSignedInState(session);
        setStatus(`Welcome, ${session.user.email}!`, 'success');
      } else if (event === 'SIGNED_OUT') {
        showAuthForm();
        setStatus('You have been signed out.', 'info');
      }
    }); 
