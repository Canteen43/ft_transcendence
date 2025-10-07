import { initParticleNumericAnimationValue } from '@tsparticles/engine';
import Chart from 'chart.js/auto';
import { z } from 'zod';
import {
	PercentageWinsHistorySchema,
	RankingSchema,
} from '../../../shared/schemas/stats';
import { apiCall } from '../utils/apiCall';
import { Modal } from './Modal';
import { TextModal } from './TextModal';

type RankingData = z.infer<typeof RankingSchema>;
type HistoryData = z.infer<typeof PercentageWinsHistorySchema>;

export class StatModal extends Modal {
	private element: HTMLElement;
	private rankData: RankingData | null = null;
	private histData: HistoryData | null = null;

	constructor(parent: HTMLElement) {
		super(parent);

		this.element = document.createElement('div');
		this.element.className =
			'mx-auto my-auto w-full h-full ' +
			'flex flex-col items-center justify-center p-4 sm:p-8';
		this.box.appendChild(this.element);

		this.initialize();
	}

	private async initialize() {
		await this.getRankData();
		await this.getHistData();
		if (this.histData || this.rankData) {
			this.createOutput();
		}
	}

	private showErrorModal(message: string) {
		new TextModal(this.element, message, undefined, () => this.destroy());
	}

	private async getRankData() {
		const { data: rankData, error: rankError } = await apiCall(
			'GET',
			'/stats/ranking',
			RankingSchema
		);
		if (rankError) {
			console.error('Error getting ranking:', rankError);
			this.showErrorModal(`Failed to get ranking: ${rankError.message}`);
			return;
		}
		if (!rankData) {
			this.showErrorModal('No ranking data available');
			return;
		}
		console.debug(rankData);
		this.rankData = rankData;
	}

	private async getHistData() {
		const userID = sessionStorage.getItem('userID');
		if (!userID) {
			this.showErrorModal('No user ID found - please login');
			return;
		}
		const { data: histData, error: histError } = await apiCall(
			'GET',
			`/stats/wins_history/${userID}`,
			PercentageWinsHistorySchema
		);
		if (histError) {
			console.error('Error getting wins history: ', histError);
			this.showErrorModal(
				`Failed to get historical data: ${histError.message}`
			);
			return;
		}
		console.debug(histData);
		this.histData = histData;
	}

	private createOutput(): void {
		const container = document.createElement('div');
		container.className =
			'w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6';

		//////////////////////
		// Left column: Historical data (without innerHTML)
		const histColumn = document.createElement('div');
		histColumn.className = 'bg-white p-4 rounded-lg';

		const imageDivLeft = document.createElement('div');
		imageDivLeft.className = 'bg-white p-8';
		histColumn.appendChild(imageDivLeft);

		const imgLeft = '../stats2.png';
		const imgHist = document.createElement('img');
		imgHist.src = imgLeft;
		imgHist.alt = 'Hist';
		imgHist.className = 'mx-auto w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28';
		imageDivLeft.appendChild(imgHist);

		// Add filter buttons
		const buttonContainer = document.createElement('div');
		buttonContainer.className = 'flex gap-2 mb-4 justify-center';

		const limits = [10, 20, 50];
		let currentLimit = 50;
		let chartInstance: Chart | null = null;

		const createChart = (limit: number) => {
			if (!this.histData) return;

			// Filter data to last N matches
			const filteredData = this.histData.slice(-limit);
			const labels = filteredData.map(d => `#${d.nr}`);
			const values = filteredData.map(d => d.percentage_wins * 100);

			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			if (chartInstance) {
				chartInstance.destroy();
			}

			chartInstance = new Chart(ctx, {
				type: 'line',
				data: {
					labels: labels,
					datasets: [
						{
							label: '% Wins',
							data: values,
							fill: false,
							backgroundColor: 'rgba(99, 102, 241, 0.2)',
							borderColor: '#2c5fa5',
							borderWidth: 2,
							tension: 0.3,
							pointRadius: 2,
							pointHoverRadius: 4,
						},
					],
				},
				options: {
					responsive: true,
					plugins: {
						legend: {
							display: true,
							position: 'top',
						},
					},
					scales: {
						y: {
							beginAtZero: true,
							min: 20,
							max: 80,
							ticks: {
								callback: value => value + '%',
							},
						},
						x: {
							ticks: {
								autoSkip: true,
								maxTicksLimit: 10,
							},
						},
					},
				},
			});
		};

		limits.forEach(limit => {
			const button = document.createElement('button');
			button.textContent = `Last ${limit}`;
			button.className =
				'px-4 py-2 rounded transition-colors font-semibold ' +
				(limit === currentLimit
					? 'bg-[var(--color3)] text-white'
					: 'bg-gray-200 text-gray-700 hover:bg-gray-300');

			button.addEventListener('click', () => {
				currentLimit = limit;
				// Update button styles
				buttonContainer.querySelectorAll('button').forEach(btn => {
					btn.className =
						'px-4 py-2 rounded transition-colors font-semibold ' +
						(btn === button
							? 'bg-[var(--color3)] text-white'
							: 'bg-gray-200 text-gray-700 hover:bg-gray-300');
				});
				createChart(limit);
			});

			buttonContainer.appendChild(button);
		});

		histColumn.appendChild(buttonContainer);

		const canvas = document.createElement('canvas');
		canvas.id = 'histChart';
		canvas.className = 'w-full h-64';
		histColumn.appendChild(canvas);

		if (this.histData) {
			createChart(currentLimit);
		}

		//////////////////////
		// Right column: Leaderboard (without innerHTML)
		const rankColumn = document.createElement('div');
		rankColumn.className = 'bg-white p-3 rounded-lg';

		const imageDivRight = document.createElement('div');
		imageDivRight.className = 'bg-white p-8';
		rankColumn.appendChild(imageDivRight);

		const imgRight = '../Leaderboard2.png';
		const imgRank = document.createElement('img');
		imgRank.src = imgRight;
		imgRank.alt = 'Hist';
		imgRank.className = 'mx-auto w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28';
		imageDivRight.appendChild(imgRank);

		// Create header
		const header = document.createElement('div');
		header.className =
			'grid grid-cols-[1rem_1fr_4rem_4rem] gap-3 sm:gap-12 ' +
			' items-center px-2 sm:px-3  py-1 sm:py-0 text-[var(--color3)] ' +
			' sticky top-2 bg-white text-sm sm:text-base';

		// Add header cells without innerHTML
		const emptyCell1 = document.createElement('span');
		const emptyCell2 = document.createElement('span');
		const playedHeader = document.createElement('span');
		playedHeader.className = 'text-center';
		playedHeader.textContent = 'Played';
		const winsHeader = document.createElement('span');
		winsHeader.className = 'text-center';
		winsHeader.textContent = '% Wins';

		header.appendChild(emptyCell1);
		header.appendChild(emptyCell2);
		header.appendChild(playedHeader);
		header.appendChild(winsHeader);
		rankColumn.appendChild(header);

		// Create grid wrapper
		const grid = document.createElement('div');

		const currentUsername = sessionStorage.getItem('username');
		if (this.rankData) {
			this.rankData.forEach(player => {
				const playerUsername = player.login ?? player.alias ?? '—';
				const isCurrentUser = currentUsername === playerUsername;

				const row = document.createElement('div');
				row.className = `grid grid-cols-[1rem_1fr_4rem_4rem] gap-3 sm:gap-12 items-center px-3 sm:px-4 py-2 sm:py-3  text-[var(--color3)] transition-colors ${
					isCurrentUser ? '' : ''
				}`;

				// Rank
				const rank = document.createElement('span');
				rank.className = `text-xl sm:text-2xl text-xl sm:text-3xl ${isCurrentUser ? 'text-[var(--color2)]' : ''}`;
				rank.textContent = player.rank.toString();

				// Name
				const name = document.createElement('span');
				name.className = `text-xl sm:text-3xl font-bold truncate ${isCurrentUser ? 'text-[var(--color2)]' : ''}`;
				name.textContent = playerUsername;

				// Played
				const played = document.createElement('div');
				played.className = `text-base sm:text-xl text-center font-semibold  min-w-[3rem] sm:min-w-[4rem]  ${isCurrentUser ? 'text-[var(--color2)]' : ''}`;
				played.textContent = player.played.toString();

				// % Wins
				const wins = document.createElement('div');
				wins.className = `text-base sm:text-xl text-center font-semibold  min-w-[3rem] sm:min-w-[4rem] ${isCurrentUser ? 'text-[var(--color2)]' : ''}`;
				wins.textContent = `${(player.percentage_wins * 100).toFixed(1)}%`;

				row.appendChild(rank);
				row.appendChild(name);
				row.appendChild(played);
				row.appendChild(wins);

				grid.appendChild(row);
			});

			rankColumn.appendChild(grid);
		}

		container.appendChild(histColumn);
		container.appendChild(rankColumn);
		this.element.appendChild(container);
	}
}
