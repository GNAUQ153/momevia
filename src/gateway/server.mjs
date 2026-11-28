import { environment } from '../shared/config.mjs';
import { createGatewayServer } from './app.mjs';

createGatewayServer(environment()).listen(4100, '127.0.0.1', () => console.log('[gateway] http://localhost:4100'));
