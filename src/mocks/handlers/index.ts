import { authHandlers, profileHandlers } from './auth'
import { cartHandlers, orderHandlers } from './cart'
import { nftHandlers } from './nfts'
import { realtimeHandler } from '../realtime'

export const handlers = [...authHandlers, ...profileHandlers, ...nftHandlers, ...cartHandlers, ...orderHandlers, realtimeHandler]
