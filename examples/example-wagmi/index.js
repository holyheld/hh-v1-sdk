import './index.css';

import { publicProvider } from '@wagmi/core/providers/public'
import { configureChains, connect, createConfig, switchNetwork } from '@wagmi/core';
import { arbitrum, avalanche, base, gnosis, mainnet, optimism, polygon, polygonZkEvm, zkSync } from '@wagmi/core/chains';
import { InjectedConnector } from '@wagmi/connectors/injected';
import { getPublicClient, getWalletClient, getNetwork } from '@wagmi/core';
import HolyheldSDK, { getNetworkChainId } from '@holyheld/sdk';
import { getSpinnerHTML, getSettingsHTML, getRadioItemHTML, getTokenInfoHTML, getDataHTML } from './templates';

const parentElement = document.querySelector('section');
const connectButton = document.querySelector('#connect');
const initializeButton = document.querySelector('#initialize');
const getSettingsButton = document.querySelector('#get-settings');
const selectHolytagButton = document.querySelector('#select-holytag');
const getTokensButton = document.querySelector('#get-tokens');
const selectTokenButton = document.querySelector('#select-token');
const setAmountButton = document.querySelector('#set-amount');
const submitButton = document.querySelector('#submit');

const chains = [arbitrum, avalanche, base, gnosis, mainnet, optimism, polygon, polygonZkEvm, zkSync];

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
  connectButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  const { publicClient, webSocketPublicClient } = configureChains(
    [mainnet, polygon, optimism, polygonZkEvm, gnosis, avalanche, arbitrum, zkSync, base],
    [publicProvider()]
  );

  createConfig({ publicClient, webSocketPublicClient });

  await connect({ connector: new InjectedConnector({ chains }) });

  initializeButton.removeAttribute('hidden');
  parentElement.innerHTML = '';
});

// 1. Initialize SDK
initializeButton.addEventListener('click', () => {
  initializeButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  // create .env with variable `VITE_HOLYHELD_SDK_API_KEY` or set it here
  const apiKey = import.meta.env.VITE_HOLYHELD_SDK_API_KEY;

  if (!apiKey) {
    alert('Set variable `VITE_HOLYHELD_SDK_API_KEY`.');
    return;
  }

  sdk = new HolyheldSDK({ apiKey, logger: true });

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
    settings.external.maxTopUpAmountInEUR
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

  const response = await sdk.getTagInfoForTopUp(holytag);

  if (!response.found) {
    alert('$holytag is not found.');
    selectHolytagButton.removeAttribute('hidden');
    parentElement.innerHTML = getSettingsHTML(
      settings.external.isTopupEnabled,
      settings.external.minTopUpAmountInEUR,
      settings.external.maxTopUpAmountInEUR
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

  const walletClient = await getWalletClient();

  const { tokens } = await sdk.getWalletBalances(walletClient.account.address);

  allTokens = tokens;

  const html = allTokens.reduce((acc, current) => {
    return `
      ${acc}
      ${getRadioItemHTML(
        acc === '',
        current.address,
        current.network,
        current.name,
        current.balance,
        current.symbol
      )}
    `;
  }, '');

  selectTokenButton.removeAttribute('hidden');
  parentElement.innerHTML = html;
});

// 5. Select token (and chain) to be used for sending
selectTokenButton.addEventListener('click', () => {
  const selectedRadio = parentElement.querySelector('input:checked');
  const [ address, network ] = selectedRadio.value.split(',');

  selectTokenButton.setAttribute('hidden', '');

  selectedToken = allTokens.find(item => item.address === address && item.network === network);

  parentElement.innerHTML = getTokenInfoHTML(
    selectedToken.name,
    selectedToken.address,
    selectedToken.network,
    selectedToken.balance,
    selectedToken.symbol
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

  const response = await sdk.convertTokenToEUR(selectedToken.address, selectedToken.decimals, String(amount), selectedToken.network);

  amountInEUR = response.EURAmount;

  const isLessThanMinimum = Number(amountInEUR) < Number(settings.external.minTopUpAmountInEUR);
  const isMoreThanMaximum = Number(amountInEUR) > Number(settings.external.maxTopUpAmountInEUR);
  const isTestHolytag = holytag.toUpperCase() === 'SDKTEST';

  if (!isTestHolytag && (isLessThanMinimum || isMoreThanMaximum)) {
    parentElement.innerHTML = getTokenInfoHTML(
      selectedToken.name,
      selectedToken.address,
      selectedToken.network,
      selectedToken.balance,
      selectedToken.symbol
    );
    setAmountButton.removeAttribute('hidden');
  }

  if (!isTestHolytag && isLessThanMinimum) {
    alert(`Minimum allowed amount is ${settings.external.minTopUpAmountInEUR} EUR`);
    return;
  }

  if (!isTestHolytag && isMoreThanMaximum) {
    alert(`Maximum allowed amount is ${settings.external.minTopUpAmountInEUR} EUR`);
    return;
  }

  transferData = response.transferData;

  parentElement.innerHTML = getDataHTML(
    selectedToken.name,
    selectedToken.address,
    selectedToken.network,
    selectedToken.symbol,
    amount,
    amountInEUR,
    holytag
  );
  submit.removeAttribute('hidden');
});

// 7. Submit sending of token to recipient's debit card (this could require more than one
//    wallet interaction, e.g. sign permit and then send a transaction
submitButton.addEventListener('click', async () => {
  const chainId = getNetwork().chain.id;
  const tokenNetworkId = getNetworkChainId(selectedToken.network);

  submitButton.setAttribute('hidden', '');
  parentElement.innerHTML = `
      ${getSpinnerHTML()}
      <dl></dl>
  `;

  const dlElement = parentElement.querySelector('dl');

  // switch to the correct chain (network) in the wallet
  if (chainId !== tokenNetworkId) {
    await switchNetwork({ chainId: tokenNetworkId })
  }

  const publicClient = getPublicClient({ chainId: tokenNetworkId });

  const walletClient = await getWalletClient({ chainId: tokenNetworkId });

  try {
    await sdk.topup(
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
        }
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
