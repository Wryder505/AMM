export const options = {
	chart: {
		height: 350,
		type: 'line',
		zoom: {
			enabled: false
		}
	},
	dataLabels: {
		enabled: false
	},
	stroke: {
		curve: 'straight'
	},
	title: {
		text: 'Reserve History',
		align: 'left'
	},
	grid: {
		row: {
			colors: ['#f3f3f3', 'transparent'], // Takes an array which will be repeated on columns
			opacity: 0.5
		},
	}
}

export const series = [{
	data: [30, 40, 45, 50, 49, 60, 70, 91]
}]
