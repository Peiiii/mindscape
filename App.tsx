import React, { useEffect } from 'react';
import Canvas from './components/Canvas';
import InputBar from './components/InputBar';
import { AiSparkleIcon } from './components/Icons';
import { PresenterProvider, usePresenter } from './context/PresenterContext';

const MindscapeApp: React.FC = () => {
    const presenter = usePresenter();

    useEffect(() => {
        presenter.canvasManager.init();
    }, [presenter]);

    return (
        <main className="bg-gray-900 text-white h-screen w-screen flex flex-col overflow-hidden">
            <header className="absolute top-0 left-0 right-0 flex items-center justify-center p-4 z-10 pointer-events-none">
                <div className="flex items-center p-2 rounded-full bg-black/30 backdrop-blur-md">
                    <AiSparkleIcon className="w-6 h-6 text-cyan-400" />
                    <h1 className="text-xl font-bold ml-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
                        Mindscape
                    </h1>
                </div>
            </header>
            <Canvas />
            <InputBar />
        </main>
    );
};

const App: React.FC = () => {
    return (
        <PresenterProvider>
            <MindscapeApp />
        </PresenterProvider>
    );
};

export default App;
