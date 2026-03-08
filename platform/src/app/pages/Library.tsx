import { useNavigate } from "react-router";
import { useState } from "react";
import { Search, ArrowLeft, Play, Share2, Download, Trash2 } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { getLibrary } from "../lib/data";

export default function Library() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "alphabetical">("recent");
  
  const library = getLibrary();

  // Filter and sort
  const filteredVideos = library.filter((video: any) => {
    const query = searchQuery.toLowerCase();
    return (
      video.title.toLowerCase().includes(query) ||
      video.authors.some((author: string) => author.toLowerCase().includes(query))
    );
  });

  const sortedVideos = [...filteredVideos].sort((a: any, b: any) => {
    if (sortBy === "recent") {
      return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
    } else {
      return a.title.localeCompare(b.title);
    }
  });

  const handleDelete = (videoId: string) => {
    const confirmed = confirm("Are you sure you want to delete this video?");
    if (confirmed) {
      const updatedLibrary = library.filter((v: any) => v.id !== videoId);
      localStorage.setItem('library', JSON.stringify(updatedLibrary));
      window.location.reload();
    }
  };

  const handleShare = (videoId: string) => {
    const url = `${window.location.origin}/v/${videoId}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      {/* Top bar */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="p-2 hover:bg-[#F4F4F0] rounded-lg transition-colors"
              style={{ color: '#6B7280' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div style={{ fontFamily: "'Instrument Serif', serif" }} className="text-2xl">
              PaperVideo
            </div>
          </div>
          <button className="text-[#6B7280] hover:text-[#1A1A1A] transition-colors">
            Sign In
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <h1 
          className="mb-8"
          style={{ 
            fontFamily: "'Instrument Serif', serif",
            fontSize: '48px',
            letterSpacing: '-0.5px',
            color: '#1A1A1A',
            fontWeight: 400
          }}
        >
          Your Library
        </h1>

        {/* Search and sort */}
        <div className="flex gap-4 mb-8">
          <div className="flex-1 relative">
            <Search 
              className="absolute left-4 top-1/2 -translate-y-1/2" 
              size={20}
              style={{ color: '#9CA3AF' }}
            />
            <Input
              type="text"
              placeholder="Search papers by title or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-xl border-[#E5E7EB] bg-white"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 h-12 rounded-xl border border-[#E5E7EB] bg-white"
            style={{ color: '#1A1A1A' }}
          >
            <option value="recent">Most Recent</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>

        {/* Empty state */}
        {sortedVideos.length === 0 && !searchQuery && (
          <div className="text-center py-24">
            <div 
              className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
              style={{ backgroundColor: '#F4F4F0' }}
            >
              <Play size={40} style={{ color: '#9CA3AF' }} />
            </div>
            <h2 
              className="mb-4"
              style={{ 
                fontFamily: "'Inter', sans-serif",
                fontSize: '24px',
                color: '#1A1A1A',
                fontWeight: 600
              }}
            >
              Your video library is empty
            </h2>
            <p className="mb-6" style={{ color: '#6B7280' }}>
              Generate your first video from any research paper
            </p>
            <Button 
              onClick={() => navigate('/')}
              style={{ backgroundColor: '#2563EB' }}
            >
              Generate Video
            </Button>
          </div>
        )}

        {/* No search results */}
        {sortedVideos.length === 0 && searchQuery && (
          <div className="text-center py-24">
            <p style={{ color: '#6B7280' }}>
              No videos found matching "{searchQuery}"
            </p>
          </div>
        )}

        {/* Video grid */}
        {sortedVideos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedVideos.map((video: any) => (
              <div 
                key={video.id}
                className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] hover:border-[#2563EB] transition-all hover:shadow-lg group"
              >
                {/* Thumbnail */}
                <div 
                  className="aspect-video flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: '#F4F4F0' }}
                  onClick={() => navigate(`/v/${video.id}`)}
                >
                  <div className="text-center p-6">
                    <Play 
                      size={48} 
                      style={{ color: '#2563EB' }}
                      className="mx-auto mb-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                    <div 
                      style={{ 
                        fontFamily: "'Instrument Serif', serif",
                        fontSize: '18px',
                        color: '#1A1A1A'
                      }}
                    >
                      {video.title.slice(0, 50)}{video.title.length > 50 ? '...' : ''}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 
                    className="mb-2 cursor-pointer hover:text-[#2563EB] transition-colors"
                    style={{ 
                      color: '#1A1A1A',
                      fontWeight: 600,
                      fontSize: '16px'
                    }}
                    onClick={() => navigate(`/v/${video.id}`)}
                  >
                    {video.title}
                  </h3>
                  <p className="text-sm mb-3" style={{ color: '#6B7280' }}>
                    {video.authors.slice(0, 2).join(", ")}
                    {video.authors.length > 2 && ` +${video.authors.length - 2} more`}
                  </p>
                  <div className="flex items-center justify-between text-xs mb-4" style={{ color: '#9CA3AF' }}>
                    <span>{new Date(video.generatedAt).toLocaleDateString()}</span>
                    <span>{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => navigate(`/v/${video.id}`)}
                      size="sm"
                      className="flex-1 gap-2"
                      style={{ backgroundColor: '#2563EB' }}
                    >
                      <Play size={14} />
                      Watch
                    </Button>
                    <Button
                      onClick={() => handleShare(video.id)}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Share2 size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Download size={14} />
                    </Button>
                    <Button
                      onClick={() => handleDelete(video.id)}
                      variant="outline"
                      size="sm"
                      className="gap-2 hover:bg-red-50"
                    >
                      <Trash2 size={14} style={{ color: '#DC2626' }} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {sortedVideos.length > 0 && (
          <div className="mt-12 text-center" style={{ color: '#6B7280' }}>
            {sortedVideos.length} {sortedVideos.length === 1 ? 'video' : 'videos'} in your library
          </div>
        )}
      </div>
    </div>
  );
}
