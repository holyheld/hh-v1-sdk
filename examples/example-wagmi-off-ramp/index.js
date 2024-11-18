import './index.css';

import {
  connect,
  createConfig,
  http,
  switchChain,
  getAccount,
  getPublicClient,
  getWalletClient,
} from '@wagmi/core';
import {
  arbitrum,
  avalanche,
  base,
  gnosis,
  mainnet,
  optimism,
  polygon,
  polygonZkEvm,
  zkSync,
} from '@wagmi/core/chains';
import { injected } from '@wagmi/connectors';
import HolyheldSDK from '@holyheld/sdk';
import {
  getSpinnerHTML,
  getSettingsHTML,
  getRadioItemHTML,
  getTokenInfoHTML,
  getDataHTML,
} from './templates';

const parentElement = document.querySelector('section');
const connectButton = document.querySelector('#connect');
const initializeButton = document.querySelector('#initialize');
const getSettingsButton = document.querySelector('#get-settings');
const selectHolytagButton = document.querySelector('#select-holytag');
const getTokensButton = document.querySelector('#get-tokens');
const selectTokenButton = document.querySelector('#select-token');
const setAmountButton = document.querySelector('#set-amount');
const submitButton = document.querySelector('#submit');

let config;
let sdk;
let settings;
let allTokens;
let selectedToken;
let amount;
let amountInEUR;
let transferData;
let holytag;

// 0. Connect wallet
connectButton.addEventListener('click', async () => {
  if (!window.ethereum) {
    alert('Enable injected provider, for example MetaMask.');
    return;
  }

  connectButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  config = createConfig({
    chains: [mainnet, polygon, optimism, polygonZkEvm, gnosis, avalanche, arbitrum, zkSync, base],
    connectors: [injected()],
    transports: {
      [mainnet.id]: http(),
      [polygon.id]: http(),
      [optimism.id]: http(),
      [polygonZkEvm.id]: http(),
      [gnosis.id]: http(),
      [avalanche.id]: http(),
      [arbitrum.id]: http(),
      [zkSync.id]: http(),
      [base.id]: http(),
    },
  });

  await connect(config, { connector: injected() });

  initializeButton.removeAttribute('hidden');
  parentElement.innerHTML = '';
});

// 1. Initialize SDK
initializeButton.addEventListener('click', async () => {
  initializeButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  // create .env with variable `VITE_HOLYHELD_SDK_API_KEY` or set it here
  const apiKey = import.meta.env.VITE_HOLYHELD_SDK_API_KEY;

  if (!apiKey) {
    alert('Set variable `VITE_HOLYHELD_SDK_API_KEY`.');
    return;
  }

  sdk = new HolyheldSDK({ apiKey, logger: true });
  await sdk.init();

  getSettingsButton.removeAttribute('hidden');
  parentElement.innerHTML = '';
});

// 2. Get SDK settings (min/max amounts and if the feature is enabled)
getSettingsButton.addEventListener('click', async () => {
  getSettingsButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  settings = await sdk.getServerSettings();

  selectHolytagButton.removeAttribute('hidden');
  parentElement.innerHTML = getSettingsHTML(
    settings.external.isTopupEnabled,
    settings.external.minTopUpAmountInEUR,
    settings.external.maxTopUpAmountInEUR,
  );
});

// 3. Select $holytag (recipient) and verify it's available for sending
selectHolytagButton.addEventListener('click', async () => {
  const input = parentElement.querySelector('input');
  holytag = input.value;

  if (!holytag) {
    alert('Enter $holytag.');
    return;
  }

  selectHolytagButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  const response = await sdk.offRamp.getTagInfoForTopUp(holytag);

  if (!response.found) {
    alert('$holytag is not found.');
    selectHolytagButton.removeAttribute('hidden');
    parentElement.innerHTML = getSettingsHTML(
      settings.external.isTopupEnabled,
      settings.external.minTopUpAmountInEUR,
      settings.external.maxTopUpAmountInEUR,
    );
    return;
  }

  getTokensButton.removeAttribute('hidden');
  parentElement.innerHTML = '';
});

// 4. Get tokens on connected wallet address (across supported chains)
getTokensButton.addEventListener('click', async () => {
  getTokensButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  const walletClient = await getWalletClient(config);

  const { tokens } = await sdk.getWalletBalances(walletClient.account.address);

  allTokens = tokens;

  const html = allTokens.reduce((acc, current) => {
    return `
      ${acc}
      ${getRadioItemHTML(
        acc === '',
        current.address,
        current.network,
        sdk.getNetwork(current.network).displayedName,
        current.name,
        current.balance,
        current.symbol,
      )}
    `;
  }, '');

  selectTokenButton.removeAttribute('hidden');
  parentElement.innerHTML = html;
});

// 5. Select token (and chain) to be used for sending
selectTokenButton.addEventListener('click', () => {
  const selectedRadio = parentElement.querySelector('input:checked');
  const [address, network] = selectedRadio.value.split(',');

  selectTokenButton.setAttribute('hidden', '');

  selectedToken = allTokens.find((item) => item.address === address && item.network === network);

  parentElement.innerHTML = getTokenInfoHTML(
    selectedToken.name,
    selectedToken.address,
    sdk.getNetwork(selectedToken.network).displayedName,
    selectedToken.balance,
    selectedToken.symbol,
  );
  setAmountButton.removeAttribute('hidden');
});

// 6. Choose amount of token to be sent
setAmountButton.addEventListener('click', async () => {
  const input = parentElement.querySelector('input');
  amount = Number(input.value);

  if (!amount) {
    alert('Choose amount.');
    return;
  }

  if (amount > Number(selectedToken.balance)) {
    alert('Insufficient Balance');
    return;
  }

  if (!settings.external.isTopupEnabled) {
    alert('Functionality is not available.');
    return;
  }

  setAmountButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  const response = await sdk.offRamp.convertTokenToEUR(
    selectedToken.address,
    selectedToken.decimals,
    String(amount),
    selectedToken.network,
  );

  amountInEUR = response.EURAmount;

  const isTestHolytag = holytag.toUpperCase() === 'SDKTEST';
  const maxTopUpAmountInEUR = isTestHolytag ? 1 : settings.external.maxTopUpAmountInEUR;
  const isLessThanMinimum = Number(amountInEUR) < Number(settings.external.minTopUpAmountInEUR);
  const isMoreThanMaximum = Number(amountInEUR) > Number(maxTopUpAmountInEUR);

  if ((!isTestHolytag && isLessThanMinimum) || isMoreThanMaximum) {
    parentElement.innerHTML = getTokenInfoHTML(
      selectedToken.name,
      selectedToken.address,
      sdk.getNetwork(selectedToken.network).displayedName,
      selectedToken.balance,
      selectedToken.symbol,
    );
    setAmountButton.removeAttribute('hidden');
  }

  if (!isTestHolytag && isLessThanMinimum) {
    alert(`Minimum allowed amount is ${settings.external.minTopUpAmountInEUR} EUR`);
    return;
  }

  if (isMoreThanMaximum) {
    alert(`Maximum allowed amount is ${maxTopUpAmountInEUR} EUR`);
    return;
  }

  transferData = response.transferData;

  parentElement.innerHTML = getDataHTML(
    selectedToken.name,
    selectedToken.address,
    sdk.getNetwork(selectedToken.network).displayedName,
    selectedToken.symbol,
    amount,
    amountInEUR,
    holytag,
  );
  submitButton.removeAttribute('hidden');
});

// 7. Submit sending of token to recipient's debit card (this could require more than one
//    wallet interaction, e.g. sign permit and then send a transaction
submitButton.addEventListener('click', async () => {
  const { chainId } = getAccount(config);
  const tokenNetworkId = sdk.getNetworkChainId(selectedToken.network);

  submitButton.setAttribute('hidden', '');
  parentElement.innerHTML = `
      ${getSpinnerHTML()}
      <dl></dl>
  `;

  const dlElement = parentElement.querySelector('dl');

  // switch to the correct chain (network) in the wallet
  if (chainId !== tokenNetworkId) {
    try {
      await switchChain(config, { chainId: tokenNetworkId });
    } catch (error) {
      parentElement.removeChild(parentElement.querySelector('img'));
      dlElement.innerHTML = `
        ${dlElement.innerHTML}
        <dt>Result:</dt>
        <dd>failed</dd>
      `;
      throw error;
    }
  }

  const publicClient = getPublicClient(config, { chainId: tokenNetworkId });

  const walletClient = await getWalletClient(config, { chainId: tokenNetworkId });

  try {
    await sdk.offRamp.topup(
      publicClient,
      walletClient,
      walletClient.account.address,
      selectedToken.address,
      selectedToken.network,
      String(amount),
      transferData,
      holytag,
      true,
      {
        onHashGenerate: (hash) => {
          dlElement.innerHTML = `
            ${dlElement.innerHTML}
            <dt>Hash:</dt>
            <dd>${hash}</dd>
          `;
        },
        onStepChange: (step) => {
          const stepElement = parentElement.querySelector('#step');
          if (stepElement) {
            stepElement.innerHTML = step;
          } else {
            dlElement.innerHTML = `
              ${dlElement.innerHTML}
              <dt>Status:</dt>
              <dd id="step">${step}</dd>
            `;
          }
        },
      },
    );
    dlElement.innerHTML = `
      ${dlElement.innerHTML}
      <dt>Result:</dt>
      <dd>success</dd>
    `;
  } catch (error) {
    dlElement.innerHTML = `
      ${dlElement.innerHTML}
      <dt>Result:</dt>
      <dd>failed</dd>
    `;
    throw error;
  } finally {
    parentElement.removeChild(parentElement.querySelector('img'));
  }
});
