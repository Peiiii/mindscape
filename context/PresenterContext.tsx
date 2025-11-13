import React, { createContext, useContext } from 'react';
import { AppPresenter } from '../presenter/AppPresenter';

const PresenterContext = createContext<AppPresenter | null>(null);

export const PresenterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const presenterRef = React.useRef<AppPresenter | null>(null);
    if (!presenterRef.current) {
        presenterRef.current = new AppPresenter();
    }

    return (
        <PresenterContext.Provider value={presenterRef.current}>
            {children}
        </PresenterContext.Provider>
    );
};

export const usePresenter = (): AppPresenter => {
    const context = useContext(PresenterContext);
    if (!context) {
        throw new Error('usePresenter must be used within a PresenterProvider');
    }
    return context;
};
