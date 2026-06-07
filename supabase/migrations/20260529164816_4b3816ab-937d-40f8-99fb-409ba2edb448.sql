
-- Add avatar_url to players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create public storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, public write (admin gate is enforced in app via PIN-protected server fn that uploads via service role; but client uploads also allowed for simplicity)
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public write avatars" ON storage.objects;
CREATE POLICY "Public write avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public update avatars" ON storage.objects;
CREATE POLICY "Public update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
