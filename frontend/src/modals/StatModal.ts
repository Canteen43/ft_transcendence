import Chart from 'chart.js/auto';
import {
	PercentageWinsHistory,
	PercentageWinsHistorySchema,
	Ranking,
	RankingItem,
	RankingItemSchema,
	RankingSchema,
	TournamentStats,
	TournamentStatsSchema,
} from '../../../shared/schemas/stats';
import { isLoggedIn } from '../buttons/AuthButton';
import { apiCall } from '../utils/apiCall';
import { Modal } from './Modal';
import { TextModal } from './TextModal';

export class StatModal extends Modal {
	private element: HTMLElement;
	private rankData: Ranking | null = null;
	private histData: PercentageWinsHistory | null = null;
	private matchData: RankingItem | null = null;
	private tournData: TournamentStats | null = null;
	private chartInstance: Chart | null = null;

	constructor(parent: HTMLElement) {
		super(parent);

		this.element = document.createElement('div');
		this.element.className =
			'mx-auto my-auto max-w-4xl max-h-[90vh] overflow-y-auto ' +
			'flex flex-col items-center justify-center p-3 sm:p-6';
		this.box.appendChild(this.element);

		if (isLoggedIn()) this.initialize();
	}

	private async initialize() {
		await this.getRankData();
		await this.getHistData();
		await this.getMatchData();
		await this.getTournData();

		if (
			!this.histData &&
			!this.rankData &&
			!this.matchData &&
			!this.tournData
		) {
			console.debug('No stat, closing modal');
			this.destroy();
			return;
		}
		this.createOutput();
	}

	private showErrorModal(message: string) {
		new TextModal(this.element, message);
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

	private async getMatchData() {
		const userID = sessionStorage.getItem('userID');
		if (!userID) {
			this.showErrorModal('No user ID found - please login');
			return;
		}
		const { data: matchData, error: matchError } = await apiCall(
			'GET',
			`/stats/ranking/${userID}`,
			RankingItemSchema
		);
		if (matchError) {
			console.error('Error getting match history: ', matchError);
			this.showErrorModal(
				`Failed to get match data: ${matchError.message}`
			);
			return;
		}
		console.debug(matchData);
		this.matchData = matchData;
	}

	private async getTournData() {
		const userID = sessionStorage.getItem('userID');
		if (!userID) {
			this.showErrorModal('No user ID found - please login');
			return;
		}
		const { data: tournData, error: tournError } = await apiCall(
			'GET',
			`/stats/tournament/${userID}`,
			TournamentStatsSchema
		);
		if (tournError) {
			console.error('Error getting match history: ', tournError);
			this.showErrorModal(
				`Failed to get match data: ${tournError.message}`
			);
			return;
		}
		console.debug(tournData);
		this.tournData = tournData;
	}

	private createOutput(): void {
		const base = "  [font-variation-settings:'wght'_900] w-full mx-auto";
		const container = document.createElement('div');
		container.className =
			this.matchData && this.histData && this.rankData
				? `${base} grid grid-cols-1 lg:grid-cols-2 gap-6`
				: `${base} flex justify-center`;

		if (this.matchData && this.histData) {
			const left = this.creatLeftSide();
			container.appendChild(left);
		}

		if (this.rankData) {
			const right = this.creatRightSide();
			container.appendChild(right);
		}

		this.element.appendChild(container);
	}

	private creatLeftSide(): HTMLDivElement {
		const leftContainer = document.createElement('div');
		leftContainer.className = 'bg-white p-6 rounded-2xl';

		// Remove image and create sections with more space between them
		if (this.matchData) {
			leftContainer.appendChild(this.createMatchData());
			leftContainer.appendChild(this.createScoreData());
		}
		if (this.tournData) {
			leftContainer.appendChild(this.createTournData());
		}
		if (this.histData) {
			leftContainer.appendChild(this.createGraph());
		}
		return leftContainer;
	}

	private creatRightSide(): HTMLDivElement {
		const rightContainer = document.createElement('div');
		rightContainer.className = 'bg-white p-6 rounded-2xl';

		// Add LEADERBOARD title
		const leaderboardTitle = document.createElement('h3');
		leaderboardTitle.className =
			'text-3xl sm:text-4xl font-nabla text-gray-800 text-center mb-4';
		leaderboardTitle.textContent = 'LEADERBOARD';
		rightContainer.appendChild(leaderboardTitle);

		rightContainer.appendChild(this.createLeaderBoard());
		return rightContainer;
	}

	//////////////////////
	// Right column: Leaderboard
	private createLeaderBoard(): HTMLDivElement {
		const leaderBoard = document.createElement('div');
		leaderBoard.className = 'bg-white p-3 w-full';

		const baseGrid =
			'grid grid-cols-[1rem_1fr_3.5rem_4rem] gap-2 sm:gap-6 items-center ';

		// header
		const header = document.createElement('div');
		header.className = `${baseGrid} px-2 sm:px-3 py-1 text-gray-600 sticky top-2 bg-white text-xs sm:text-sm`;

		// header cells
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
		leaderBoard.appendChild(header);

		// Create grid wrapper
		const grid = document.createElement('div');

		const currentUsername = sessionStorage.getItem('username');
		if (this.rankData) {
			this.rankData.forEach(player => {
				const playerUsername = player.login ?? player.alias ?? '—';
				const isCurrentUser = currentUsername === playerUsername;

				const row = document.createElement('div');
				row.className = `${baseGrid} px-3 sm:px-4 py-2 sm:py-3 text-gray-500   transition-colors `;
				//  ${  isCurrentUser ? 'text-[var(--color6)] username-glow  font-bold' : ''

				// Rank
				const rank = document.createElement('span');
				rank.className = `text-sm sm:text-base ${isCurrentUser ? 'text-pink username-glow font-bold' : ''}`;
				rank.textContent = player.rank.toString() + '.';

				// Name
				const name = document.createElement('span');
				name.className = `text-sm sm:text-base font-bold truncate  ${isCurrentUser ? 'text-pink username-glow ' : ''}`;
				name.textContent = playerUsername;

				// Played
				const played = document.createElement('div');
				played.className = `text-xs sm:text-sm text-center min-w-[3rem] sm:min-w-[4rem] ${isCurrentUser ? 'text-pink username-glow  font-bold' : ''}`;
				played.textContent = player.played.toString();

				// % Wins
				const wins = document.createElement('div');
				wins.className = `text-xs sm:text-sm text-center min-w-[3rem] sm:min-w-[4rem] ${isCurrentUser ? 'text-pink username-glow font-bold' : ''}`;
				wins.textContent = `${(player.percentage_wins * 100).toFixed(1)}%`;

				row.appendChild(rank);
				row.appendChild(name);
				row.appendChild(played);
				row.appendChild(wins);

				grid.appendChild(row);
			});

			leaderBoard.appendChild(grid);
		}
		return leaderBoard;
	}
	/////////////////
	// individual data
	private createMatchData(): HTMLDivElement {
		const matchContainer = document.createElement('div');
		matchContainer.className = 'flex flex-col gap-1 mb-8';

		// Match Stats Title
		const matchTitle = document.createElement('h3');
		matchTitle.className =
			'text-3xl sm:text-4xl font-nabla text-gray-800 text-center mb-2';
		matchTitle.textContent = 'All Matches';
		matchContainer.appendChild(matchTitle);

		// Header row
		const header = document.createElement('div');
		header.className =
			'grid grid-cols-3 gap-0 text-center text-gray-600 items-center text-xs sm:text-sm  ';

		const playedHeader = document.createElement('span');
		playedHeader.textContent = 'Played';
		const winsHeader = document.createElement('span');
		winsHeader.textContent = 'Wins';
		const percentHeader = document.createElement('span');
		percentHeader.textContent = '% Wins';

		header.appendChild(playedHeader);
		header.appendChild(winsHeader);
		header.appendChild(percentHeader);
		matchContainer.appendChild(header);

		// Data row
		const dataRow = document.createElement('div');
		dataRow.className =
			'grid grid-cols-3 gap-0 text-center items-center text-gray-500';

		const total = document.createElement('span');
		total.className = 'text-lg sm:text-xl leading-none';
		total.textContent = this.matchData!.played.toString();

		const totalWin = document.createElement('span');
		totalWin.className = 'text-lg sm:text-xl leading-none';
		totalWin.textContent = this.matchData!.wins.toString();

		const percentWin = document.createElement('span');
		percentWin.className = 'text-lg sm:text-xl font-bold leading-none';
		percentWin.textContent = `${(this.matchData!.percentage_wins * 100).toFixed(1)}%`;

		dataRow.appendChild(total);
		dataRow.appendChild(totalWin);
		dataRow.appendChild(percentWin);

		matchContainer.appendChild(dataRow);

		return matchContainer;
	}

	/////////////////
	// tourn data
	private createTournData(): HTMLDivElement {
		const matchContainer = document.createElement('div');
		matchContainer.className = 'flex flex-col gap-1 mb-8';

		// Tournament Stats Title
		const matchTitle = document.createElement('h3');
		matchTitle.className =
			'text-3xl sm:text-4xl font-nabla text-gray-800 text-center mb-2';
		matchTitle.textContent = 'Tournaments';
		matchContainer.appendChild(matchTitle);

		// Header row
		const header = document.createElement('div');
		header.className =
			'grid grid-cols-3 gap-0 text-center text-gray-600 items-center text-xs sm:text-sm  ';

		const playedHeader = document.createElement('span');
		playedHeader.textContent = 'Played';
		const winsHeader = document.createElement('span');
		winsHeader.textContent = '% Finals';
		const percentHeader = document.createElement('span');
		percentHeader.textContent = '% Wins';

		header.appendChild(playedHeader);
		header.appendChild(winsHeader);
		header.appendChild(percentHeader);
		matchContainer.appendChild(header);

		// Data row
		const dataRow = document.createElement('div');
		dataRow.className =
			'grid grid-cols-3 gap-0 text-center items-center text-gray-500';

		const total = document.createElement('span');
		total.className = 'text-lg sm:text-xl leading-none';
		total.textContent = this.tournData!.played.toString();

		const percentFinal = document.createElement('span');
		percentFinal.className = 'text-lg sm:text-xl leading-none';
		percentFinal.textContent = `${(this.tournData!.percentage_final * 100).toFixed(1)}%`;

		const percentWin = document.createElement('span');
		percentWin.className = 'text-lg sm:text-xl font-bold leading-none';
		percentWin.textContent = `${(this.tournData!.percentage_wins * 100).toFixed(1)}%`;

		dataRow.appendChild(total);
		dataRow.appendChild(percentFinal);
		dataRow.appendChild(percentWin);

		matchContainer.appendChild(dataRow);

		return matchContainer;
	}

	private createScoreData(): HTMLDivElement {
		// Goals bar graph
		const goalsContainer = document.createElement('div');
		goalsContainer.className = 'flex flex-col gap-1 mb-8';

		// Goals Title
		const goalsTitle = document.createElement('h3');
		goalsTitle.className =
			'text-3xl sm:text-4xl font-nabla text-gray-800 text-center mb-2';
		goalsTitle.textContent = 'Goals';
		goalsContainer.appendChild(goalsTitle);

		const goalsScored = this.matchData!.goals_scored;
		const goalsAgainst = this.matchData!.goals_against;
		const totalGoals = goalsScored + goalsAgainst;
		const scoredPercentage = (goalsScored / totalGoals) * 100;
		const againstPercentage = (goalsAgainst / totalGoals) * 100;

		// Goals header
		const goalsHeader = document.createElement('div');
		goalsHeader.className = 'flex justify-between text-xs text-gray-600  ';

		const scoredLabel = document.createElement('span');
		scoredLabel.textContent = `Scored: ${goalsScored}`;
		const concededLabel = document.createElement('span');
		concededLabel.textContent = `Conceded: ${goalsAgainst}`;

		goalsHeader.appendChild(scoredLabel);
		goalsHeader.appendChild(concededLabel);
		goalsContainer.appendChild(goalsHeader);

		// Bar graph
		const barContainer = document.createElement('div');
		barContainer.className = 'flex h-8 rounded-sm overflow-hidden';

		const scoredBar = document.createElement('div');
		scoredBar.className =
			'bg-[var(--color6)] flex items-center justify-center text-white text-xs  ';
		scoredBar.style.width = `${scoredPercentage}%`;
		scoredBar.textContent =
			scoredPercentage > 15 ? `${scoredPercentage.toFixed(0)}%` : '';

		const concededBar = document.createElement('div');
		concededBar.className =
			'bg-[var(--color7)] flex items-center justify-center text-white text-xs  ';
		concededBar.style.width = `${againstPercentage}%`;
		concededBar.textContent =
			againstPercentage > 15 ? `${againstPercentage.toFixed(0)}%` : '';

		barContainer.appendChild(scoredBar);
		barContainer.appendChild(concededBar);

		goalsContainer.appendChild(barContainer);

		return goalsContainer;
	}

	/////////////////
	// GRAPH CUMULATIVE WINS
	private createGraph(): HTMLDivElement {
		const graph = document.createElement('div');
		graph.className = 'flex flex-col gap-1 mb-8';

		// Graph Title
		const graphTitle = document.createElement('h3');
		graphTitle.className =
			'text-3xl sm:text-4xl font-nabla text-gray-800 text-center mb-2';
		graphTitle.textContent = '% Wins History';
		graph.appendChild(graphTitle);

		const buttonContainer = document.createElement('div');
		buttonContainer.className = 'flex gap-2  justify-center';

		const limits = [20, 50, 100];
		let currentLimit = 100;

		const createChart = (limit: number) => {
			if (!this.histData) return;

			const filteredData = this.histData.slice(0, limit);
			const orderedData = filteredData.reverse();
			const labels = orderedData.map(d => `#${d.nr}`);
			const values = orderedData.map(d => d.percentage_wins * 100);

			// Calculate symmetrical Y-axis bounds
			const percentages = values;
			const minPercentage = Math.min(...percentages);
			const maxPercentage = Math.max(...percentages);

			// Find the furthest distance from 50%
			const distanceFrom50 = Math.max(
				Math.abs(minPercentage - 50),
				Math.abs(maxPercentage - 50)
			);

			// Add 15% padding
			const range = Math.max(distanceFrom50 + 15, 15);

			// Create symmetrical bounds around 50%
			let minY = Math.max(0, Math.round(50 - range));
			let maxY = Math.min(100, Math.round(50 + range));

			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			if (this.chartInstance) {
				this.chartInstance.destroy();
			}

			this.chartInstance = new Chart(ctx, {
				type: 'line',
				data: {
					labels: labels,
					datasets: [
						{
							label: '% Wins',
							data: values,
							fill: false,
							backgroundColor: 'rgba(249, 252, 54, 0.94)',
							borderColor: '#ee1af5ff',
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
							display: false,
						},
					},
					scales: {
						y: {
							beginAtZero: false,
							min: minY,
							max: maxY,
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
				'px-4 py-1 rounded transition-colors   ' +
				(limit === currentLimit
					? 'bg-pink-300 text-white'
					: 'bg-gray-200 text-gray-700 hover:bg-gray-300');

			button.addEventListener('click', () => {
				currentLimit = limit;
				buttonContainer.querySelectorAll('button').forEach(btn => {
					btn.className =
						'px-4 py-1 rounded transition-colors   ' +
						(btn === button
							? 'bg-pink-300 text-white'
							: 'bg-gray-200 text-gray-700 hover:bg-gray-300');
				});
				createChart(limit);
			});

			buttonContainer.appendChild(button);
		});

		graph.appendChild(buttonContainer);

		const canvas = document.createElement('canvas');
		canvas.id = 'histChart';
		canvas.className = 'w-full h-64';
		graph.appendChild(canvas);

		if (this.histData) {
			createChart(currentLimit);
		}
		return graph;
	}

	public destroy(): void {
		if (this.chartInstance) {
			this.chartInstance.destroy();
			this.chartInstance = null;
		}
		super.destroy();
	}
}
