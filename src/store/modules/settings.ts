import Vue from 'vue';
import { ethers } from 'ethers';
import store from '@/store';
import provider from '@/helpers/provider';
import { getExchangeRatesFromCoinGecko, getPotions, getAllowances } from '@/helpers/utils';
import { abi as ierc20Abi } from '@/helpers/abi/IERC20.json';
import { abi as factoryAbi } from '@/helpers/abi/Factory.json';

const parseEther = ethers.utils.parseEther;

const ethereum = window['ethereum'];
if (ethereum) {
  ethereum.on('accountsChanged', () => store.dispatch('init'));
  ethereum.on('networkChanged', network => {
    store.commit('set', { network: ethers.utils.getNetwork(parseInt(network)) });
  });
}

const state = {
  loading: false,
  address: null,
  name: '',
  balance: 0,
  network: {},
  exchangeRates: {},
  potions: [],
  allowances: {}
};

const mutations = {
  set(_state, payload) {
    Object.keys(payload).forEach(key => {
      Vue.set(_state, key, payload[key]);
    });
  }
};

const actions = {
  init: async ({ commit, dispatch }) => {
    commit('set', { loading: true });
    await dispatch('getExchangeRates');
    if (provider) {
      try {
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        if (address) await dispatch('login');
      } catch (e) {
        console.log(e);
      }
    }
    commit('set', { loading: false });
  },
  login: async ({ commit, dispatch }) => {
    if (provider) {
      try {
        await ethereum.enable();
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const name = await provider.lookupAddress(address);
        const balance = await provider.getBalance(address);
        const network = await provider.getNetwork();
        await dispatch('loadPotions', address);
        await dispatch('loadAllowances', address);
        commit('set', {
          address,
          name,
          balance: ethers.utils.formatEther(balance),
          network,
          loading: false
        });
      } catch (error) {
        console.error(error);
      }
    }
  },
  loading: ({ commit }, payload) => {
    commit('set', { loading: payload });
  },
  async getExchangeRates({ commit }) {
    const exchangeRates = await getExchangeRatesFromCoinGecko();
    commit('set', { exchangeRates });
  },
  async loadPotions({ commit }, payload) {
    const potions = await getPotions(payload);
    console.log('Your potions', potions);
    commit('set', { potions });
  },
  async loadAllowances({ commit }, payload) {
    const allowances = await getAllowances(payload);
    console.log('Your allowances', allowances);
    commit('set', { allowances });
  },
  async approve({ commit }) {
    const factoryAddress = process.env.VUE_APP_FACTORY_ADDRESS;
    const daiAddress = process.env.VUE_APP_DAI_ADDRESS;
    const signer = provider.getSigner();
    // @ts-ignore
    const collateral = new ethers.Contract(daiAddress, ierc20Abi, provider);
    const collateralWithSigner = collateral.connect(signer);
    const tx = await collateralWithSigner.approve(factoryAddress, parseEther((1e9).toString()));
    console.log(tx.hash);
    await tx.wait();
  },
  async writeMintPotion({ commit }, payload) {
    const factoryAddress = process.env.VUE_APP_FACTORY_ADDRESS;
    const finderAddress = process.env.VUE_APP_FINDER_ADDRESS;
    const tokenFactoryAddress = process.env.VUE_APP_TOKEN_FACTORY_ADDRESS;
    const timerAddress = process.env.VUE_APP_TOKEN_FACTORY_ADDRESS;
    const daiAddress = process.env.VUE_APP_DAI_ADDRESS;
    const poolLpAddress = process.env.VUE_APP_POOL_LP_ADDRESS;
    const signer = provider.getSigner();
    // @ts-ignore
    const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
    const factoryWithSigner = factory.connect(signer);
    const params = {
      expirationTimestamp: '1590969600',
      withdrawalLiveness: '1',
      collateralAddress: daiAddress,
      finderAddress,
      tokenFactoryAddress,
      priceFeedIdentifier: 'UMATEST',
      syntheticName: 'ETH Potion Token June',
      syntheticSymbol: 'GOLDPOT6',
      liquidationLiveness: '1',
      collateralRequirement: { rawValue: parseEther('1.0') },
      disputeBondPct: { rawValue: parseEther('0.1') },
      sponsorDisputeRewardPct: { rawValue: parseEther('0.1') },
      disputerDisputeRewardPct: { rawValue: parseEther('0.1') },
      strikePrice: { rawValue: parseEther('100') },
      timerAddress,
      assetPrice: { rawValue: parseEther('200') }
    };
    const tx = await factoryWithSigner.writeMintPotion(
      params,
      poolLpAddress,
      { rawValue: parseEther('700') },
      { rawValue: parseEther('10') },
      { gasLimit: 7e6, gasPrice: ethers.utils.parseUnits('20', 'gwei') }
    );
    console.log(tx.hash);
    await tx.wait();
    // await new Promise(resolve => setTimeout(resolve, 1e3));
  }
};

export default {
  state,
  mutations,
  actions
};
