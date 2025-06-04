// ============================================================================
// ENHANCED AUTHENTICATION SYSTEM
// ============================================================================

class AuthManager {
    constructor() {
        this.isSignUpMode = false
        this.currentUser = null
        this.init()
    }

    async init() {
        // Check if user is already logged in
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            this.currentUser = user
            await this.handleAuthenticatedUser()
        }

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.handleSignIn(session)
            } else if (event === 'SIGNED_OUT') {
                this.handleSignOut()
            }
        })

        this.setupEventListeners()
    }

    setupEventListeners() {
        // Mode toggle
        const modeLink = document.getElementById('mode-link')
        if (modeLink) {
            modeLink.addEventListener('click', (e) => {
                e.preventDefault()
                this.toggleMode()
            })
        }

        // Form submission
        const signInBtn = document.getElementById('signInBtn')
        const signUpBtn = document.getElementById('signUpBtn')
        const signOutBtn = document.getElementById('signOutBtn')

        if (signInBtn) {
            signInBtn.addEventListener('click', () => this.handleSignIn())
        }

        if (signUpBtn) {
            signUpBtn.addEventListener('click', () => this.handleSignUp())
        }

        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.handleSignOut())
        }

        // Enter key submission
        const emailInput = document.getElementById('email')
        const passwordInput = document.getElementById('password')
        
        if (emailInput && passwordInput) {
            [emailInput, passwordInput].forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.isSignUpMode ? this.handleSignUp() : this.handleSignIn()
                    }
                })
            })
        }
    }

    toggleMode() {
        this.isSignUpMode = !this.isSignUpMode
        const modeText = document.getElementById('mode-text')
        const modeLink = document.getElementById('mode-link')
        const signInBtn = document.getElementById('signInBtn')
        const signUpBtn = document.getElementById('signUpBtn')
        const subtitle = document.querySelector('.subtitle')

        if (this.isSignUpMode) {
            modeText.textContent = 'Already have an account? '
            modeLink.textContent = 'Sign in'
            signInBtn.style.display = 'none'
            signUpBtn.style.display = 'flex'
            subtitle.textContent = 'Create your professional account'
        } else {
            modeText.textContent = "Don't have an account? "
            modeLink.textContent = 'Create one'
            signInBtn.style.display = 'flex'
            signUpBtn.style.display = 'none'
            subtitle.textContent = 'Sign in to your account'
        }
    }

    async handleSignIn() {
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value

        if (!this.validateInputs(email, password)) return

        this.showLoading('Signing in...')

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })

            if (error) throw error

            this.showSuccess('Sign in successful!')
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard/dashboard.html'
            }, 1000)

        } catch (error) {
            this.showError(error.message)
        } finally {
            this.hideLoading()
        }
    }

    async handleSignUp() {
        const email = document.getElementById('email').value
        const password = document.getElementById('password').value

        if (!this.validateInputs(email, password)) return

        // Extract name from email for initial profile
        const userName = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ')
        const displayName = userName.charAt(0).toUpperCase() + userName.slice(1)

        this.showLoading('Creating account...')

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: displayName
                    }
                }
            })

            if (error) throw error

            if (data.user && !data.user.email_confirmed_at) {
                this.showInfo('Please check your email to confirm your account.')
            } else {
                this.showSuccess('Account created successfully!')
                setTimeout(() => {
                    window.location.href = '/dashboard/dashboard.html'
                }, 1000)
            }

        } catch (error) {
            this.showError(error.message)
        } finally {
            this.hideLoading()
        }
    }

    async handleSignOut() {
        this.showLoading('Signing out...')

        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error

            this.showSuccess('Signed out successfully!')
            
            // Redirect to login
            setTimeout(() => {
                window.location.href = '/auth/joinus.html'
            }, 1000)

        } catch (error) {
            this.showError(error.message)
        } finally {
            this.hideLoading()
        }
    }

    async handleAuthenticatedUser() {
        // If on login page and user is authenticated, redirect to dashboard
        if (window.location.pathname.includes('joinus.html')) {
            window.location.href = '/dashboard/dashboard.html'
            return
        }

        // Show authenticated state
        const authForm = document.getElementById('auth-form')
        const signedInState = document.getElementById('signed-in-state')
        const userEmail = document.getElementById('user-email')

        if (authForm && signedInState && userEmail) {
            authForm.style.display = 'none'
            signedInState.style.display = 'block'
            userEmail.textContent = this.currentUser.email
        }
    }

    validateInputs(email, password) {
        if (!email || !password) {
            this.showError('Please fill in all fields')
            return false
        }

        if (!this.isValidEmail(email)) {
            this.showError('Please enter a valid email address')
            return false
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters')
            return false
        }

        return true
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    showLoading(text = 'Processing...') {
        const loadingOverlay = document.getElementById('loading-overlay')
        const loadingText = document.getElementById('loading-text')
        
        if (loadingOverlay && loadingText) {
            loadingText.textContent = text
            loadingOverlay.style.display = 'flex'
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay')
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none'
        }
    }

    showError(message) {
        this.showMessage(message, 'error')
    }

    showSuccess(message) {
        this.showMessage(message, 'success')
    }

    showInfo(message) {
        this.showMessage(message, 'info')
    }

    showMessage(message, type = 'info') {
        const statusMessage = document.getElementById('status-message')
        if (statusMessage) {
            statusMessage.textContent = message
            statusMessage.className = `status-message ${type} show`
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                statusMessage.classList.remove('show')
            }, 5000)
        }
    }

    // Get current user profile
    async getCurrentUserProfile() {
        if (!this.currentUser) return null

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error fetching user profile:', error)
            return null
        }
    }

    // Update user profile
    async updateUserProfile(updates) {
        if (!this.currentUser) return null

        try {
            const { data, error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', this.currentUser.id)
                .select()
                .single()

            if (error) throw error
            return data
        } catch (error) {
            console.error('Error updating user profile:', error)
            throw error
        }
    }

    // Check if user needs to complete profile
    async needsProfileSetup() {
        const profile = await this.getCurrentUserProfile()
        if (!profile) return true

        // Check if essential fields are missing
        return !profile.full_name || !profile.job_title || profile.profile_completeness < 50
    }
}

// Profile Setup Modal
class ProfileSetupModal {
    constructor(authManager) {
        this.authManager = authManager
        this.create()
    }

    create() {
        const modal = document.createElement('div')
        modal.id = 'profile-setup-modal'
        modal.className = 'modal-overlay'
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Complete Your Profile</h2>
                    <p>Help others discover you by completing your profile</p>
                </div>
                <form id="profile-setup-form" class="modal-form">
                    <div class="form-group">
                        <label for="full-name">Full Name *</label>
                        <input type="text" id="full-name" required>
                    </div>
                    <div class="form-group">
                        <label for="job-title">Job Title *</label>
                        <input type="text" id="job-title" placeholder="e.g., Software Engineer" required>
                    </div>
                    <div class="form-group">
                        <label for="location">Location</label>
                        <input type="text" id="location" placeholder="e.g., New York, NY">
                    </div>
                    <div class="form-group">
                        <label for="bio">Bio</label>
                        <textarea id="bio" placeholder="Tell us about yourself..." rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="skills">Skills (comma separated)</label>
                        <input type="text" id="skills" placeholder="e.g., JavaScript, React, Node.js">
                    </div>
                    <div class="modal-actions">
                        <button type="button" id="skip-setup" class="btn btn-secondary">Skip for now</button>
                        <button type="submit" class="btn btn-primary">Save Profile</button>
                    </div>
                </form>
            </div>
        `
        document.body.appendChild(modal)

        this.setupEventListeners()
    }

    setupEventListeners() {
        const form = document.getElementById('profile-setup-form')
        const skipBtn = document.getElementById('skip-setup')

        form.addEventListener('submit', (e) => {
            e.preventDefault()
            this.handleSubmit()
        })

        skipBtn.addEventListener('click', () => {
            this.hide()
        })
    }

    async handleSubmit() {
        const formData = new FormData(document.getElementById('profile-setup-form'))
        const skills = document.getElementById('skills').value
            .split(',')
            .map(skill => skill.trim())
            .filter(skill => skill)

        const profileData = {
            full_name: document.getElementById('full-name').value,
            job_title: document.getElementById('job-title').value,
            location: document.getElementById('location').value,
            bio: document.getElementById('bio').value,
            skills: skills,
            profile_completeness: this.calculateCompleteness(formData)
        }

        try {
            await this.authManager.updateUserProfile(profileData)
            this.authManager.showSuccess('Profile updated successfully!')
            this.hide()
        } catch (error) {
            this.authManager.showError('Failed to update profile')
        }
    }

    calculateCompleteness(formData) {
        const fields = ['full_name', 'job_title', 'location', 'bio', 'skills']
        const completed = fields.filter(field => {
            const value = document.getElementById(field.replace('_', '-')).value
            return value && value.trim()
        }).length
        
        return Math.round((completed / fields.length) * 100)
    }

    show() {
        const modal = document.getElementById('profile-setup-modal')
        modal.style.display = 'flex'
    }

    hide() {
        const modal = document.getElementById('profile-setup-modal')
        modal.style.display = 'none'
    }
}

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager()
    
    // Show profile setup modal if needed (only on dashboard)
    if (window.location.pathname.includes('dashboard.html')) {
        setTimeout(async () => {
            if (window.authManager.currentUser) {
                const needsSetup = await window.authManager.needsProfileSetup()
                if (needsSetup) {
                    const profileModal = new ProfileSetupModal(window.authManager)
                    profileModal.show()
                }
            }
        }, 2000)
    }
})

// Export for other modules
window.AuthManager = AuthManager
window.ProfileSetupModal = ProfileSetupModal

