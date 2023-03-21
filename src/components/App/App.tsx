import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';

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
