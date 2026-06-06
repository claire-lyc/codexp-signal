import { MessageSquare, Shield, AlertTriangle, CheckCircle, ThumbsUp, Reply } from 'lucide-react';
import { useState } from 'react';

const forumPosts = [
  {
    id: 1,
    author: 'Sarah T.',
    time: '2 hours ago',
    content: 'Does anyone know if Tampines community center is distributing N95 masks today? Need some for my elderly parents.',
    verified: false,
    aiFlag: false,
    likes: 12,
    replies: 3,
  },
  {
    id: 2,
    author: 'MOH Official',
    time: '3 hours ago',
    content: 'Important reminder: All mask distribution points are listed on the official MOH website. Please check there for the latest information.',
    verified: true,
    aiFlag: false,
    likes: 45,
    replies: 1,
  },
  {
    id: 3,
    author: 'John L.',
    time: '5 hours ago',
    content: 'Flood waters receding in East Coast area. Roads are passable now but still be careful.',
    verified: false,
    aiFlag: false,
    likes: 8,
    replies: 2,
  },
  {
    id: 4,
    author: 'Anonymous User',
    time: '6 hours ago',
    content: 'BREAKING: All hospitals running out of beds and turning away patients!!!',
    verified: false,
    aiFlag: true,
    likes: 0,
    replies: 0,
  },
];

export default function PublicForum() {
  const [newPost, setNewPost] = useState('');
  const [showPostSubmitted, setShowPostSubmitted] = useState(false);

  const handleSubmitPost = () => {
    if (newPost.trim()) {
      setShowPostSubmitted(true);
      setNewPost('');
      setTimeout(() => setShowPostSubmitted(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Community Forum</h1>
        <p className="text-zinc-400">Share updates and request help from your community</p>
      </div>

      <div className="bg-gradient-to-r from-purple-950/50 to-blue-950/50 border border-purple-900/50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-900/50 rounded-lg">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Content Moderation & Safety</h3>
            <p className="text-sm text-zinc-300">
              All forum posts are monitored using AI to detect misinformation and harmful content. Flagged posts undergo human verification before removal. Official government accounts are verified with a badge.
            </p>
          </div>
        </div>
      </div>

      {showPostSubmitted && (
        <div className="bg-green-950/50 border border-green-800 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <div>
              <h3 className="font-semibold text-green-400 mb-1">Post Submitted</h3>
              <p className="text-sm text-zinc-300">
                Your post is under moderation and will appear shortly after verification.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Create a Post
        </h2>

        <div className="space-y-4">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Share an update or ask for help from your community..."
            rows={4}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          <div className="bg-yellow-950/30 border border-yellow-800 rounded-lg p-3">
            <div className="flex items-start gap-2 text-xs text-yellow-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Moderation Notice:</strong> All posts are scanned by AI for misinformation and harmful content. Posts flagged as potential misinformation will be reviewed by human moderators before publication. Verified facts will be prioritized.
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmitPost}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Post to Community
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Community Updates</h2>
        <div className="space-y-4">
          {forumPosts.map((post) => (
            <div
              key={post.id}
              className={`border rounded-lg p-5 ${
                post.aiFlag
                  ? 'bg-red-950/20 border-red-800'
                  : post.verified
                  ? 'bg-green-950/10 border-green-900/30'
                  : 'bg-zinc-800 border-zinc-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{post.author}</span>
                  {post.verified && (
                    <div className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-950 text-green-400 rounded">
                      <CheckCircle className="w-3 h-3" />
                      <span>Official</span>
                    </div>
                  )}
                  {post.aiFlag && (
                    <div className="flex items-center gap-1 text-xs px-2 py-0.5 bg-red-950 text-red-400 rounded">
                      <AlertTriangle className="w-3 h-3" />
                      <span>AI Flagged - Under Review</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-zinc-500">{post.time}</span>
              </div>

              <p className={`text-sm mb-3 ${post.aiFlag ? 'blur-sm select-none' : 'text-zinc-300'}`}>
                {post.content}
              </p>

              {post.aiFlag && (
                <div className="mb-3 p-3 bg-red-950/30 border border-red-800 rounded">
                  <div className="flex items-start gap-2 text-xs text-red-400">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Content Flagged:</strong> This post has been flagged by AI as potential misinformation. Human moderators are verifying the claims. Content is hidden until verification is complete.
                    </div>
                  </div>
                </div>
              )}

              {!post.aiFlag && (
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <button className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                    <ThumbsUp className="w-4 h-4" />
                    <span>{post.likes}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                    <Reply className="w-4 h-4" />
                    <span>{post.replies} replies</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-950/30 border border-blue-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
          <div className="text-sm text-zinc-300">
            <strong className="text-blue-400">Community Guidelines:</strong> Posts containing misinformation, hate speech, or harmful content will be removed. Repeated violations may result in account suspension. Always verify information from official government sources before sharing. Report suspicious content using the flag button.
          </div>
        </div>
      </div>
    </div>
  );
}
