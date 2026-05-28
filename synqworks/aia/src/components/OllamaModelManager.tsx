import { useState, useEffect } from "react";
import { invokeSafe } from "../lib/utils/tauri";
import { useUiStore } from "../lib/stores/uiStore";

type Props = {
  onClose?: () => void;
};

export default function OllamaModelManager({ onClose }: Props) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pullModel, setPullModel] = useState("");
  const [pulling, setPulling] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  const checkConnection = async () => {
    setCheckingConnection(true);
    try {
      const isConnected = await invokeSafe<boolean>("ollama_check_connection");
      setConnected(isConnected || false);
    } catch {
      setConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const loadModels = async () => {
    setLoading(true);
    try {
      const modelList = await invokeSafe<string[]>("ollama_list_models");
      setModels(modelList || []);
    } catch (e) {
      console.error("Failed to load models:", e);
      useUiStore.getState().addToast({
        message: "Failed to load models. Is Ollama running?",
        type: "error",
        ttl: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePullModel = async () => {
    if (!pullModel.trim()) return;

    setPulling(true);
    try {
      const result = await invokeSafe<string>("ollama_pull_model", {
        model: pullModel.trim(),
      });

      useUiStore.getState().addToast({
        message: result || "Model downloaded successfully",
        type: "success",
        ttl: 3000,
      });

      setPullModel("");
      // Refresh model list
      await loadModels();
    } catch (e: any) {
      useUiStore.getState().addToast({
        message: `Failed to download model: ${e.message || e}`,
        type: "error",
        ttl: 4000,
      });
    } finally {
      setPulling(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (connected) {
      loadModels();
    }
  }, [connected]);

  return (
    <div className="w-96 bg-gray-100 text-gray-900 border border-gray-300 dark:bg-gray-900 dark:text-white dark:border-gray-700 rounded shadow-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Ollama Model Manager</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Connection Status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${checkingConnection
                ? "bg-yellow-500"
                : connected
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
          />
          <span className="text-sm">
            {checkingConnection
              ? "Checking connection..."
              : connected
                ? "Connected to Ollama"
                : "Ollama not available"}
          </span>
          <button
            onClick={checkConnection}
            className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Retry
          </button>
        </div>

        {!connected && !checkingConnection && (
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
            <p className="mb-1">Make sure Ollama is installed and running:</p>
            <code className="text-xs">ollama serve</code>
          </div>
        )}
      </div>

      {connected && (
        <>
          {/* Download New Model */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Download Model</h3>
            <div className="flex gap-2">
              <input
                value={pullModel}
                onChange={(e) => setPullModel(e.target.value)}
                placeholder="e.g., llama3.2, codellama, mistral"
                className="flex-1 px-2 py-1 rounded bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !pulling) {
                    handlePullModel();
                  }
                }}
              />
              <button
                onClick={handlePullModel}
                disabled={pulling || !pullModel.trim()}
                className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white"
              >
                {pulling ? "Downloading..." : "Pull"}
              </button>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Popular models: llama3.2, codellama, mistral, phi3, gemma2
            </div>
          </div>

          {/* Installed Models */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Installed Models</h3>
              <button
                onClick={loadModels}
                disabled={loading}
                className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-60"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1">
              {loading ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 p-2">
                  Loading models...
                </div>
              ) : models.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  No models installed. Download one above to get started.
                </div>
              ) : (
                models.map((model) => (
                  <div
                    key={model}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                  >
                    <span className="text-sm font-mono">{model}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(model);
                        useUiStore.getState().addToast({
                          message: "Model name copied to clipboard",
                          type: "success",
                          ttl: 1500,
                        });
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500"
                    >
                      Copy
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {models.length > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
              💡 Copy a model name and paste it into the "Default model" field
              in Settings to use it as your default Ollama model.
            </div>
          )}
        </>
      )}

      <div className="flex justify-end">
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1 text-sm rounded bg-gray-200 border border-gray-300 hover:bg-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
