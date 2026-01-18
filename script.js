class WeatherApp {
    constructor() {
        this.API_KEY = 'YOUR_API_KEY';
        this.BASE_URL = 'https://api.openweathermap.org/data/2.5';
        this.GEO_URL = 'http://api.openweathermap.org/geo/1.0/direct';
        
        this.cityInput = document.getElementById('cityInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.geoBtn = document.getElementById('geoBtn');
        this.loading = document.getElementById('loading');
        this.errorDiv = document.getElementById('error');
        this.currentWeather = document.getElementById('currentWeather');
        this.forecastSection = document.getElementById('forecastSection');
        this.favoritesList = document.getElementById('favoritesList');
        this.citySuggestions = document.getElementById('citySuggestions');
        this.clearFavoritesBtn = document.getElementById('clearFavorites');

        this.favorites = JSON.parse(localStorage.getItem('weatherFavorites')) || [];
        this.init();
    }

    init() {
        this.loadFavorites();
        this.searchBtn.addEventListener('click', () => this.searchWeather());
        this.cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchWeather();
        });
        this.cityInput.addEventListener('input', this.debounce(this.autoComplete.bind(this), 300));
        this.geoBtn.addEventListener('click', () => this.getCurrentLocation());
        
        if (this.clearFavoritesBtn) {
            this.clearFavoritesBtn.addEventListener('click', () => this.clearAllFavorites());
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async autoComplete(query) {
        if (query.length < 2) {
            this.citySuggestions.innerHTML = '';
            return;
        }
        try {
            const res = await fetch(`${this.GEO_URL}?q=${encodeURIComponent(query)}&limit=5&appid=${this.API_KEY}`);
            if (!res.ok) return;
            const cities = await res.json();
            this.citySuggestions.innerHTML = cities.map(city => 
                `<option value="${city.name}, ${city.state || city.country}">`
            ).join('');
        } catch (e) {
            console.error('Autocomplete error:', e);
        }
    }

    async searchWeather(city = null) {
        const inputCity = city || this.cityInput.value.trim();
        if (!inputCity) {
            this.showError('Please enter a city name');
            return;
        }

        this.showLoading(true);
        this.hideError();
        this.currentWeather.style.display = 'none';
        this.forecastSection.style.display = 'none';

        try {
            const [currentData, forecastData] = await Promise.all([
                this.fetchWeatherData(`${this.BASE_URL}/weather?q=${encodeURIComponent(inputCity)}&appid=${this.API_KEY}&units=metric`),
                this.fetchWeatherData(`${this.BASE_URL}/forecast?q=${encodeURIComponent(inputCity)}&appid=${this.API_KEY}&units=metric`)
            ]);

            this.displayCurrent(currentData);
            this.displayAdvancedForecast(forecastData);
            this.saveFavorite(inputCity);
            this.cityInput.value = inputCity;

        } catch (error) {
            console.error('Weather fetch error:', error);
            this.showError(error.message || 'Failed to fetch weather data');
        } finally {
            this.showLoading(false);
        }
    }

    async getCurrentLocation() {
        if (!navigator.geolocation) {
            return this.showError('Geolocation not supported by your browser');
        }
        
        this.showLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const res = await fetch(`${this.GEO_URL}?lat=${latitude}&lon=${longitude}&limit=1&appid=${this.API_KEY}`);
                    const [location] = await res.json();
                    if (location) {
                        this.searchWeather(`${location.name}`);
                    } else {
                        this.showError('Could not determine your location');
                    }
                } catch (e) {
                    this.showError('Location service unavailable');
                }
            },
            (error) => {
                let message = 'Location access denied';
                switch(error.code) {
                    case error.PERMISSION_DENIED: message = 'Location access denied'; break;
                    case error.POSITION_UNAVAILABLE: message = 'Location unavailable'; break;
                    case error.TIMEOUT: message = 'Location request timeout'; break;
                }
                this.showError(message);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    }

    async fetchWeatherData(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`API Error ${res.status}: ${errorText}`);
        }
        return res.json();
    }

    displayCurrent(data) {
        document.getElementById('currentTemp').textContent = `${Math.round(data.main.temp)}°C`;
        document.getElementById('weatherIcon').textContent = this.getWea
