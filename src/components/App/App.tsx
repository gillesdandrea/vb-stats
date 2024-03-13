// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';

import Shell from '../Shell/Shell';

const queryClient = new QueryClient({});

const App = () => {
  // console.log('rendering App');
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          // algorithm: theme.defaultAlgorithm,
          algorithm: theme.darkAlgorithm,
        }}
      >
        <Shell />
      </ConfigProvider>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
};

export default App;
