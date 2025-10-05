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


		const imgLeft = '../Leaderboard.png';
		const imgRight = '../Leaderboard2.png';


		const container = document.createElement('div');
		container.className =
			'w-full max-w-6xl grid grid-cols-1 lg:grid-cols2 gap-6';

		// Left column: Historical data (without innerHTML)
		const histColumn = document.createElement('div');
		histColumn.className = 'bg-white p-4 rounded-lg';

		const histTitle = document.createElement('h2');
		histTitle.className = 'text-2xl font-bold mb-4';
		histTitle.textContent = 'Win History';
		histColumn.appendChild(histTitle);

		const imgHist = document.createElement('img');
		imgHist.src = imgLeft;
		imgHist.alt = 'Hist';
		imgHist.className = 'w-12 h-12 sm:w-16 sm:h-16 md:w-18 md:h-18';
		histColumn.appendChild(imgHist);

		if (this.histData) {
			// Process and display histData
		}

		// Right column: Leaderboard (without innerHTML)
		const rankColumn = document.createElement('div');
		rankColumn.className = 'bg-white p-4 rounded-lg';

		const rankTitle = document.createElement('h2');
		rankTitle.className = 'text-2xl font-bold mb-4';
		rankTitle.textContent = 'Leaderboard';
		rankColumn.appendChild(rankTitle);


		const imgRank = document.createElement('img');
		imgRank.src = imgLeft;
		imgRank.alt = 'Hist';
		imgRank.className = 'w-12 h-12 sm:w-16 sm:h-16 md:w-18 md:h-18';
		rankColumn.appendChild(imgRank);

		const currentUsername = sessionStorage.getItem('username');

		// Create header
		const header = document.createElement('div');
		header.className =
			'grid grid-cols-[auto_1fr_auto_auto] gap-3 sm:gap-12 ' +
			' items-center p-3 sm:p-4 text-[var(--color3)] font-bold ' +
			' sticky top-0 bg-white text-sm sm:text-base';

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

		if (this.rankData) {
			this.rankData.forEach(player => {
				const playerUsername = player.login ?? player.alias ?? '—';
				const isCurrentUser = currentUsername === playerUsername;

				const row = document.createElement('div');
				row.className = `grid grid-cols-[auto_1fr_auto_auto] gap-3 sm:gap-12 items-center p-3 sm:p-4 text-[var(--color3)] transition-colors ${
					isCurrentUser ? '' : ''
				}`;

				// Rank
				const rank = document.createElement('span');
				rank.className = `text-xl sm:text-2xl text-xl sm:text-3xl ${isCurrentUser ? 'text-[var(--color4)]' : ''}`;
				rank.textContent = player.rank.toString();

				// Name
				const name = document.createElement('span');
				name.className = `font-bold truncate ${isCurrentUser ? 'text-3xl sm:text-5xl text-[var(--color4)]' : 'text-xl sm:text-3xl '}`;
				name.textContent = playerUsername;

				// Played
				const played = document.createElement('div');
				played.className = `text-center font-semibold  min-w-[3rem] sm:min-w-[4rem]  ${isCurrentUser ? 'text-2xl sm:text-3xl text-[var(--color4)]' : 'text-base sm:text-xl'}`;
				played.textContent = player.played.toString();

				// % Wins
				const wins = document.createElement('div');
				wins.className = `text-center font-semibold  min-w-[3rem] sm:min-w-[4rem] ${isCurrentUser ? 'text-2xl sm:text-3xl text-[var(--color4)]' : 'text-base sm:text-xl'}`;
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
