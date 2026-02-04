import { useState, useEffect } from 'react';

export function MainControlPage() {
  const [isDeployed, setIsDeployed] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    // Check if button is already deployed
    window.api.isButtonDeployed().then(setIsDeployed);
  }, []);

  const handleDeploy = async () => {
    setStatus('Deploying...');
    const result = await window.api.deployFloatingButton();
    if (result.success) {
      setIsDeployed(true);
      setStatus('✓ Floating button deployed! Look for it at the bottom-right of your screen.');
    } else {
      setStatus(`Error: ${result.message}`);
    }
  };

  const handleHide = async () => {
    setStatus('Hiding...');
    const result = await window.api.hideFloatingButton();
    if (result.success) {
      setIsDeployed(false);
      setStatus('Floating button hidden.');
    } else {
      setStatus(`Error: ${result.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Backtrack
            </h1>
            <p className="text-gray-600">
              AI-Powered File Organization
            </p>
          </div>

          {/* Deploy Button */}
          <div className="space-y-4">
            {!isDeployed ? (
              <button
                onClick={handleDeploy}
                className="w-full py-4 px-6 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                Deploy Backtrack Button
              </button>
            ) : (
              <button
                onClick={handleHide}
                className="w-full py-4 px-6 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                Hide Backtrack Button
              </button>
            )}

            {/* Status Message */}
            {status && (
              <div className={`p-4 rounded-lg text-sm ${
                status.includes('Error')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                {status}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              How it works:
            </h3>
            <ol className="text-sm text-gray-600 space-y-2">
              <li>1. Click "Deploy Backtrack Button" above</li>
              <li>2. Look for the floating button at bottom-right of your screen</li>
              <li>3. Click the floating button to open the chat drawer</li>
              <li>4. Organize your files using natural language</li>
            </ol>
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          Gemini 3 Hackathon Project • Day 2 Progress
        </p>
      </div>
    </div>
  );
}
