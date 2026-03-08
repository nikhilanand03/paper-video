import { useState } from "react";
import { Direction, AssetType, DIRECTIONS, ASSET_TYPES } from "./data";
import { VideoPreview } from "./components/VideoPreview";
import { MonitorPlay, LayoutTemplate, Palette } from "lucide-react";

export default function App() {
  const [direction, setDirection] = useState<Direction>("A");
  const [assetType, setAssetType] = useState<AssetType>("title_card");

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-80 border-r border-zinc-800 bg-zinc-900/50 flex flex-col shrink-0 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-8">
          <MonitorPlay className="w-6 h-6 text-indigo-400" />
          <h1 className="font-semibold text-lg tracking-tight">Make Video Assets</h1>
        </div>

        <div className="space-y-8">
          {/* Visual Direction Section */}
          <div>
            <div className="flex items-center gap-2 mb-4 text-zinc-400 text-sm font-medium uppercase tracking-wider">
              <Palette className="w-4 h-4" />
              <h2>Visual Direction</h2>
            </div>
            <div className="space-y-2">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir.id}
                  onClick={() => setDirection(dir.id as Direction)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 ${
                    direction === dir.id
                      ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-100"
                      : "bg-zinc-800/30 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200"
                  }`}
                >
                  <div className="font-medium mb-1">{dir.id}. {dir.name}</div>
                  <div className="text-xs opacity-70">{dir.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Asset Type Section */}
          <div>
            <div className="flex items-center gap-2 mb-4 text-zinc-400 text-sm font-medium uppercase tracking-wider">
              <LayoutTemplate className="w-4 h-4" />
              <h2>Asset Type</h2>
            </div>
            <div className="space-y-2">
              {ASSET_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setAssetType(type.id as AssetType)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 flex items-center justify-between ${
                    assetType === type.id
                      ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                      : "bg-zinc-900/30 border-zinc-800/50 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                  }`}
                >
                  <span className="font-medium">{type.name}</span>
                  {assetType === type.id && (
                    <div className="w-2 h-2 rounded-full bg-zinc-300" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 p-8 bg-zinc-950 flex flex-col">
        <div className="flex-1 w-full h-full relative border border-zinc-800 rounded-2xl bg-zinc-900/30 overflow-hidden shadow-2xl shadow-black/50">
          <div className="absolute top-4 left-4 z-10 bg-zinc-800/80 backdrop-blur-md px-3 py-1.5 rounded-md text-xs font-mono text-zinc-300 border border-zinc-700 shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500/80 animate-pulse" />
            1920 × 1080 Preview
          </div>
          <VideoPreview direction={direction} assetType={assetType} />
        </div>
        
        <div className="mt-4 text-center text-sm text-zinc-500">
          Viewing a complete set of strictly defined assets for the specific visual direction.
        </div>
      </div>
    </div>
  );
}
