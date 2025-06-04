// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================

// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://your-project-id.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key-here'

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Global configuration
const CONFIG = {
    // App settings
    APP_NAME: 'ProfX',
    DEFAULT_AVATAR_COLOR: '#667eea',
    
    // Post limits
    DAILY_POST_LIMIT: 5,
    PREMIUM_POST_LIMIT: 20,
    
    // Pagination
    POSTS_PER_PAGE: 10,
    NOTIFICATIONS_PER_PAGE: 20,
    
    // File upload limits
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    
    // Real-time channels
    CHANNELS: {
        POSTS: 'posts_channel',
        NOTIFICATIONS: 'notifications_channel',
        ACTIVITIES: 'activities_channel'
    }
}

// Utility functions
const utils = {
    // Generate avatar SVG with initials
    generateAvatar: (name, size = 40) => {
        const initials = name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2)
        
        return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'%3E%3Ccircle cx='${size/2}' cy='${size/2}' r='${size/2}' fill='url(%23grad1)'/%3E%3Cdefs%3E%3ClinearGradient id='grad1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23667eea'/%3E%3Cstop offset='100%25' style='stop-color:%23764ba2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ctext x='${size/2}' y='${size/2 + size/8}' text-anchor='middle' fill='white' font-family='Inter' font-weight='600' font-size='${size/3}'%3E${initials}%3C/text%3E%3C/svg%3E`
    },
    
    // Format time ago
    timeAgo: (date) => {
        const now = new Date()
        const diff = now - new Date(date)
        const seconds = Math.floor(diff / 1000)
        const minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)
        
        if (days > 0) return `${days}d ago`
        if (hours > 0) return `${hours}h ago`
        if (minutes > 0) return `${minutes}m ago`
        return 'Just now'
    },
    
    // Extract hashtags from text
    extractHashtags: (text) => {
        const regex = /#[\w]+/g
        return text.match(regex) || []
    },
    
    // Sanitize HTML
    sanitizeHtml: (html) => {
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(html)
        }
        return html // Fallback if DOMPurify not available
    },
    
    // Format numbers (1200 -> 1.2k)
    formatNumber: (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
        return num.toString()
    },
    
    // Show loading state
    showLoading: (element, text = 'Loading...') => {
        element.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <span>${text}</span>
            </div>
        `
    },
    
    // Show error message
    showError: (message, duration = 5000) => {
        const errorDiv = document.createElement('div')
        errorDiv.className = 'error-toast'
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `
        document.body.appendChild(errorDiv)
        
        setTimeout(() => {
            errorDiv.remove()
        }, duration)
    },
    
    // Show success message
    showSuccess: (message, duration = 3000) => {
        const successDiv = document.createElement('div')
        successDiv.className = 'success-toast'
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `
        document.body.appendChild(successDiv)
        
        setTimeout(() => {
            successDiv.remove()
        }, duration)
    },
    
    // Debounce function
    debounce: (func, wait) => {
        let timeout
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout)
                func(...args)
            }
            clearTimeout(timeout)
            timeout = setTimeout(later, wait)
        }
    }
}

// Authentication helpers
const auth = {
    // Get current user
    getCurrentUser: async () => {
        const { data: { user } } = await supabase.auth.getUser()
        return user
    },
    
    // Get user profile
    getUserProfile: async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
        
        if (error) throw error
        return data
    },
    
    // Check if user is authenticated
    isAuthenticated: async () => {
        const user = await auth.getCurrentUser()
        return !!user
    },
    
    // Redirect to login if not authenticated
    requireAuth: async () => {
        const isAuth = await auth.isAuthenticated()
        if (!isAuth) {
            window.location.href = '/auth/joinus.html'
            return false
        }
        return true
    }
}

// Database helpers
const db = {
    // Get user's post feed
    getFeed: async (userId, limit = CONFIG.POSTS_PER_PAGE, offset = 0) => {
        const { data, error } = await supabase
            .rpc('get_user_feed', {
                user_id: userId,
                limit_count: limit,
                offset_count: offset
            })
        
        if (error) throw error
        return data
    },
    
    // Create a new post
    createPost: async (postData) => {
        const { data, error } = await supabase
            .from('posts')
            .insert([postData])
            .select()
            .single()
        
        if (error) throw error
        return data
    },
    
    // Get user's communities
    getUserCommunities: async (userId) => {
        const { data, error } = await supabase
            .from('community_members')
            .select(`
                *,
                communities(*)
            `)
            .eq('user_id', userId)
            .eq('is_active', true)
        
        if (error) throw error
        return data
    },
    
    // Get job recommendations
    getJobRecommendations: async (userId, limit = 5) => {
        const { data, error } = await supabase
            .from('job_recommendations')
            .select('*')
            .eq('user_id', userId)
            .order('match_percentage', { ascending: false })
            .limit(limit)
        
        if (error) throw error
        return data
    },
    
    // Get user notifications
    getNotifications: async (userId, limit = CONFIG.NOTIFICATIONS_PER_PAGE) => {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit)
        
        if (error) throw error
        return data
    },
    
    // Mark notification as read
    markNotificationRead: async (notificationId) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
        
        if (error) throw error
    }
}

// Real-time subscriptions
const realtime = {
    // Subscribe to posts
    subscribeToPosts: (callback) => {
        return supabase
            .channel(CONFIG.CHANNELS.POSTS)
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'posts' },
                callback
            )
            .subscribe()
    },
    
    // Subscribe to notifications
    subscribeToNotifications: (userId, callback) => {
        return supabase
            .channel(CONFIG.CHANNELS.NOTIFICATIONS)
            .on('postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`
                },
                callback
            )
            .subscribe()
    },
    
    // Unsubscribe from channel
    unsubscribe: (channel) => {
        return supabase.removeChannel(channel)
    }
}

// Export everything to global scope
window.CONFIG = CONFIG
window.utils = utils
window.auth = auth
window.db = db
window.realtime = realtime
window.supabase = supabase

console.log('ProfX Configuration loaded successfully')

