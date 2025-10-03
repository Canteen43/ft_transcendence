import Chart from 'chart.js/auto';
import {
	PercentageWinsHistorySchema,
	RankingSchema,
} from '../../../shared/schemas/stats';
import { Button } from '../buttons/Button';
import { apiCall } from '../utils/apiCall';
import { Modal } from './Modal';
import { TextModal } from './TextModal';

export class RankModal extends Modal {
	private element: HTMLElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.element = document.createElement('div');
		this.element.className =
			'mx-auto my-auto w-full h-full ' +
			'flex flex-col items-center justify-center p-4 sm:p-8';

		// Add the element to the modal content
		this.box.appendChild(this.element);

		this.getData();
	}

	private showErrorModal(message: string) {
		new TextModal(this.element, message, undefined, () => this.destroy());
	}

	private async getData() {
		const { data: getRanking, error: rankError } = await apiCall(
			'GET',
			'/stats/ranking',
			RankingSchema
		);
		if (rankError) {
			console.error('Error getting ranking:', rankError);
			this.showErrorModal(`Failed to get ranking: ${rankError.message}`);
			return;
		}
		console.debug(getRanking);

		if (!getRanking) return;

		const currentUsername = sessionStorage.getItem('username');

		// Create container for rankings
		const container = document.createElement('div');
		container.className =
			'w-full max-w-4xl max-h-[80vh] overflow-auto bg-white';

		// Create header
		const header = document.createElement('div');
		header.className =
			'grid grid-cols-[auto_1fr_auto_auto] gap-3 sm:gap-12 ' +
			' items-center p-3 sm:p-4 text-[var(--color3)] font-bold ' +
			' sticky top-0 bg-white' +
			' text-sm sm:text-base';
		header.innerHTML = `
			<span></span>
			<span></span>
			<span class="text-center">Played</span>
			<span class="text-center">% Wins</span>
		`;
		container.appendChild(header);

		// Create grid wrapper
		const grid = document.createElement('div');


		getRanking.forEach(player => {
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
			played.className =
				`text-center font-semibold  min-w-[3rem] sm:min-w-[4rem]  ${isCurrentUser ? 'text-2xl sm:text-3xl text-[var(--color4)]' : 'text-base sm:text-xl'}`;
			played.textContent = player.played.toString();

			// % Wins
			const wins = document.createElement('div');
			wins.className =
				`text-center font-semibold  min-w-[3rem] sm:min-w-[4rem] ${isCurrentUser ? 'text-2xl sm:text-3xl text-[var(--color4)]' : 'text-base sm:text-xl'}`;
			wins.textContent = `${(player.percentage_wins * 100).toFixed(1)}%`;

			row.appendChild(rank);
			row.appendChild(name);
			row.appendChild(played);
			row.appendChild(wins);

			grid.appendChild(row);
		});

		container.appendChild(grid);

		console.debug('appending rankings to element');
		this.element.appendChild(container);

		// Optional: build a chart
		// this.showChart(getRanking);
	}
}
