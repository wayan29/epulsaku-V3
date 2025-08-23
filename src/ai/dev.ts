
// Flows will be imported for their side effects in this file.
import './flows/verify-pin-flow';
import './flows/fetch-digiflazz-products-flow';
import './flows/fetch-digiflazz-balance-flow';
import './flows/inquire-pln-customer-flow'; 
import './flows/create-digiflazz-deposit-flow'; 
import './flows/inquire-free-fire-nickname-flow'; 
import './flows/inquire-mobile-legends-nickname-flow'; 
import './flows/inquire-genshin-impact-nickname-flow'; 
import './flows/inquire-honkai-star-rail-nickname-flow'; 
import './flows/purchase-digiflazz-product-flow'; 
import './flows/send-telegram-message-flow';
import './flows/chat-flow';
import './flows/check-balances-and-notify-flow';

// TokoVoucher Flows
import './flows/tokovoucher/fetchTokoVoucherBalance-flow';
import './flows/tokovoucher/fetchTokoVoucherCategories-flow';
import './flows/tokovoucher/fetchTokoVoucherOperators-flow';
import './flows/tokovoucher/fetchTokoVoucherProductTypes-flow';
import './flows/tokovoucher/fetchTokoVoucherProducts-flow';
import './flows/tokovoucher/purchaseTokoVoucherProduct-flow';
import './flows/tokovoucher/createTokoVoucherDeposit-flow'; 
import './flows/tokovoucher/checkTokoVoucherTransactionStatus-flow';