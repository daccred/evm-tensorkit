import React from 'react';
import { RainbowKitProvider as RKProvider, getDefaultConfig, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { mainnet, goerli, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from 'next-themes';

const config = getDefaultConfig({
  appName: 'Smart Contract Preview',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '',
  chains: [mainnet, goerli, sepolia],
  ssr: true,
});

const queryClient = new QueryClient();

export function RainbowKitProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RKProvider
          theme={isDarkMode ? darkTheme() : lightTheme()}
          modalSize="compact"
        >
          {children}
        </RKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}