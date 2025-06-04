-- ============================================================================
-- SUPABASE DATABASE SCHEMA FOR PROFESSIONAL SOCIAL PLATFORM
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USER PROFILES TABLE
-- ============================================================================
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    job_title TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    skills TEXT[], -- Array of skills
    experience_years INTEGER DEFAULT 0,
    profile_completeness INTEGER DEFAULT 0 CHECK (profile_completeness >= 0 AND profile_completeness <= 100),
    skill_score INTEGER DEFAULT 0 CHECK (skill_score >= 0 AND skill_score <= 100),
    is_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. POSTS TABLE
-- ============================================================================
CREATE TABLE posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    media_urls TEXT[], -- Array of image/video URLs
    link_url TEXT,
    link_title TEXT,
    link_description TEXT,
    link_image TEXT,
    post_type TEXT DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'link', 'poll', 'document')),
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'connections', 'private')),
    tags TEXT[], -- Array of hashtags
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. POST INTERACTIONS TABLE
-- ============================================================================
CREATE TABLE post_interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'comment', 'share', 'bookmark')),
    comment_text TEXT, -- Only for comments
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id, interaction_type, comment_text) -- Prevent duplicate interactions
);

-- ============================================================================
-- 4. CONNECTIONS TABLE (Following/Followers)
-- ============================================================================
CREATE TABLE connections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- ============================================================================
-- 5. COMMUNITIES TABLE
-- ============================================================================
CREATE TABLE communities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    avatar_icon TEXT, -- FontAwesome icon class
    avatar_color TEXT DEFAULT '#667eea',
    banner_url TEXT,
    member_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. COMMUNITY MEMBERS TABLE
-- ============================================================================
CREATE TABLE community_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id, user_id)
);

-- ============================================================================
-- 7. JOB RECOMMENDATIONS TABLE
-- ============================================================================
CREATE TABLE job_recommendations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    job_title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    company_icon TEXT, -- FontAwesome icon class
    salary_min INTEGER,
    salary_max INTEGER,
    match_percentage INTEGER CHECK (match_percentage >= 0 AND match_percentage <= 100),
    job_url TEXT,
    location TEXT,
    job_type TEXT CHECK (job_type IN ('full-time', 'part-time', 'contract', 'remote')),
    is_applied BOOLEAN DEFAULT FALSE,
    is_saved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================================================
-- 8. USER ACTIVITY TRACKING
-- ============================================================================
CREATE TABLE user_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'post_create', 'profile_view', 'job_view', 'skill_assessment')),
    metadata JSONB, -- Store additional activity data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'job_match', 'community_invite', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id UUID, -- Can reference posts, users, jobs, etc.
    related_type TEXT, -- 'post', 'user', 'job', 'community'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. TRENDING TOPICS TABLE
-- ============================================================================
CREATE TABLE trending_topics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    topic TEXT UNIQUE NOT NULL,
    post_count INTEGER DEFAULT 0,
    trend_score FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. USER POSTS LIMIT TRACKING
-- ============================================================================
CREATE TABLE user_post_limits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    posts_today INTEGER DEFAULT 0,
    last_post_date DATE DEFAULT CURRENT_DATE,
    daily_limit INTEGER DEFAULT 5, -- Can be higher for premium users
    UNIQUE(user_id, last_post_date)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Posts indexes
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_visibility ON posts(visibility);
CREATE INDEX idx_posts_tags ON posts USING GIN(tags);

-- Post interactions indexes
CREATE INDEX idx_post_interactions_post_id ON post_interactions(post_id);
CREATE INDEX idx_post_interactions_user_id ON post_interactions(user_id);

-- Connections indexes
CREATE INDEX idx_connections_follower ON connections(follower_id);
CREATE INDEX idx_connections_following ON connections(following_id);

-- Communities indexes
CREATE INDEX idx_community_members_community ON community_members(community_id);
CREATE INDEX idx_community_members_user ON community_members(user_id);

-- Job recommendations indexes
CREATE INDEX idx_job_recommendations_user ON job_recommendations(user_id);
CREATE INDEX idx_job_recommendations_match ON job_recommendations(match_percentage DESC);

-- Notifications indexes
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_post_limits ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Posts policies
CREATE POLICY "Anyone can view public posts" ON posts FOR SELECT USING (
    visibility = 'public' OR 
    user_id = auth.uid() OR
    (visibility = 'connections' AND EXISTS (
        SELECT 1 FROM connections 
        WHERE (follower_id = auth.uid() AND following_id = posts.user_id AND status = 'accepted')
        OR (following_id = auth.uid() AND follower_id = posts.user_id AND status = 'accepted')
    ))
);
CREATE POLICY "Users can create own posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Post interactions policies
CREATE POLICY "Users can view post interactions" ON post_interactions FOR SELECT USING (true);
CREATE POLICY "Users can create interactions" ON post_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interactions" ON post_interactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interactions" ON post_interactions FOR DELETE USING (auth.uid() = user_id);

-- Job recommendations policies
CREATE POLICY "Users can view own job recommendations" ON job_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own job recommendations" ON job_recommendations FOR UPDATE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update community member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE communities 
        SET member_count = member_count + 1 
        WHERE id = NEW.community_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE communities 
        SET member_count = member_count - 1 
        WHERE id = OLD.community_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for community member count
CREATE TRIGGER community_member_count_trigger
    AFTER INSERT OR DELETE ON community_members
    FOR EACH ROW EXECUTE FUNCTION update_community_member_count();

-- ============================================================================
-- SAMPLE DATA INSERTION
-- ============================================================================

-- Insert sample communities
INSERT INTO communities (name, description, avatar_icon, member_count) VALUES
('JavaScript Developers', 'A community for JavaScript enthusiasts and professionals', 'fab fa-js', 2500),
('React Enthusiasts', 'Learn and share React best practices', 'fab fa-react', 1800),
('AI & Machine Learning', 'Discuss the latest in AI and ML technologies', 'fas fa-brain', 3200),
('Remote Workers', 'Tips and discussions for remote work success', 'fas fa-home', 4500),
('Career Growth', 'Professional development and career advice', 'fas fa-chart-line', 1200);

-- Insert sample trending topics
INSERT INTO trending_topics (topic, post_count, trend_score) VALUES
('#RemoteWork', 2300, 95.5),
('#AI', 1800, 87.2),
('#WebDevelopment', 1400, 78.9),
('#CareerAdvice', 950, 65.3),
('#Python', 800, 58.7);

-- ============================================================================
-- USEFUL VIEWS
-- ============================================================================

-- View for post feed with user information
CREATE VIEW post_feed AS
SELECT 
    p.*,
    pr.full_name,
    pr.job_title,
    pr.avatar_url,
    pr.is_verified,
    COALESCE(like_count, 0) as like_count,
    COALESCE(comment_count, 0) as comment_count,
    COALESCE(share_count, 0) as share_count
FROM posts p
JOIN profiles pr ON p.user_id = pr.id
LEFT JOIN (
    SELECT post_id, COUNT(*) as like_count
    FROM post_interactions 
    WHERE interaction_type = 'like'
    GROUP BY post_id
) likes ON p.id = likes.post_id
LEFT JOIN (
    SELECT post_id, COUNT(*) as comment_count
    FROM post_interactions 
    WHERE interaction_type = 'comment'
    GROUP BY post_id
) comments ON p.id = comments.post_id
LEFT JOIN (
    SELECT post_id, COUNT(*) as share_count
    FROM post_interactions 
    WHERE interaction_type = 'share'
    GROUP BY post_id
) shares ON p.id = shares.post_id
ORDER BY p.created_at DESC;

-- View for user connection counts
CREATE VIEW user_connection_stats AS
SELECT 
    pr.id,
    pr.full_name,
    COALESCE(followers.follower_count, 0) as follower_count,
    COALESCE(following.following_count, 0) as following_count
FROM profiles pr
LEFT JOIN (
    SELECT following_id, COUNT(*) as follower_count
    FROM connections 
    WHERE status = 'accepted'
    GROUP BY following_id
) followers ON pr.id = followers.following_id
LEFT JOIN (
    SELECT follower_id, COUNT(*) as following_count
    FROM connections 
    WHERE status = 'accepted'
    GROUP BY follower_id
) following ON pr.id = following.follower_id;