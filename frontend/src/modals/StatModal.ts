import {
	PercentageWinsHistorySchema,
	RankingSchema,
} from '../../../shared/schemas/stats';
import { Button } from '../buttons/Button';
import { apiCall } from '../utils/apiCall';
import { Modal } from './Modal';
import { TextModal } from './TextModal';
import Chart from 'chart.js/auto';

export class StatModal extends Modal {
	private element: HTMLElement;

	constructor(parent: HTMLElement) {
		super(parent);

		this.element = document.createElement('div');
		this.element.className =
			'mx-auto my-auto w-full h-full bg-gray-800/80 ' +
			'shadow-2xl flex flex-colitems-center justify-center';

		this.getData();
	}

	private showErrorModal(message: string) {
		new TextModal(this.element, message, undefined, () => this.destroy());
	}

	private async getData() {
		const userID = sessionStorage.getItem('userID');
		if (!userID) {
			this.showErrorModal('No user ID found - please login');
			return;
		}
		const { data: getdata, error: histErr } = await apiCall(
			'GET',
			`/stats/wins_history/${userID}`,
			PercentageWinsHistorySchema
		);

		if (histErr) {
			console.error('Error getting wins history:', histErr);
			this.showErrorModal(
				`Failed to get historical data: ${histErr.message}`
			);
		}
		console.debug(getdata);

		const { data: getRanking, error: rankError } = await apiCall(
			'GET',
			'/stats/ranking',
			RankingSchema
		);
		if (rankError) {
			console.error('Error getting ranking:', rankError);
			this.showErrorModal(`Failed to get ranking: ${rankError.message}`);
		}
		console.debug(getRanking);
	}
}
