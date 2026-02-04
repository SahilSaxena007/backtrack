export function ChatDrawerPage() {
  const handleClose = async () => {
    await window.api.closeDrawer();
  };

  return (
    <div className="w-full h-full flex items-end justify-start p-4">
      {/* Chat Drawer Container with rounded corners and shadow */}
      <div className="w-full h-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg"></div>
            <h1 className="text-base font-semibold text-gray-900">Backtrack</h1>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Content - Welcome Message */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-xs">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
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
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Welcome to Backtrack!
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Your AI-powered file organization assistant
            </p>
            <p className="text-xs text-gray-500">
              Task 4 will add the full chat interface here
            </p>
          </div>
        </div>

        {/* Footer - Input Area Placeholder */}
        <div className="h-16 border-t border-gray-200 flex items-center px-4 bg-gray-50">
          <div className="flex-1 h-10 bg-white border border-gray-300 rounded-lg flex items-center px-3 text-sm text-gray-400">
            Type your message...
          </div>
        </div>
      </div>
    </div>
  );
}
