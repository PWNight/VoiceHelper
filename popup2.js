// Функция для озвучивания текста
function speak(text) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    synth.speak(utterance);
}

// Функция для обработки команды
async function processCommand(text) {
    const statusDiv = document.getElementById('status');
    const lowerCaseText = text.toLowerCase();

    if (lowerCaseText.startsWith('открой сайт')) {
        const searchTerm = lowerCaseText.substring('открой сайт'.length).trim();
        if (searchTerm === "") {
            statusDiv.textContent = "Не указан поисковый запрос.";
            speak("Не указан поисковый запрос.");
            return;
        }

        try {
            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
            chrome.tabs.update({ url: googleSearchUrl }, () => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
                    if (changeInfo.status === 'complete' && tab.url === googleSearchUrl) {
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            function: grabLinksAndTitles
                        }, (results) => {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                return;
                            }
                            const sites = results && results[0] && results[0].result ? results[0].result : [];
                            if (sites.length > 0) {
                                let message = "Выберите сайт для открытия (назовите цифру от 1 до 5): ";
                                for (let i = 0; i < Math.min(5, sites.length); i++) {
                                    message += `${i + 1}. ${sites[i].title}\n`;
                                }
                                statusDiv.textContent = message;
                                speak(message);

                                // Переписано под голосовой ввод
                                const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                                recognition.lang = 'ru-RU';
                                recognition.start();

                                recognition.onresult = (event) => {
                                    const choice = event.results[0][0].transcript.trim();
                                    const num = parseInt(choice) - 1;
                                    if (num >= 0 && num < Math.min(5, sites.length)) {
                                        chrome.tabs.update({ url: sites[num].link });
                                        speak("Открываю сайт: " + sites[num].title);
                                    } else {
                                        statusDiv.textContent = "Некорректный выбор.";
                                        speak("Некорректный выбор.");
                                    }
                                };

                                recognition.onerror = () => {
                                    statusDiv.textContent = "Ошибка распознавания выбора.";
                                    speak("Ошибка распознавания выбора.");
                                };
                            } else {
                                statusDiv.textContent = "Ссылки не найдены.";
                                speak("Ссылки не найдены.");
                            }
                        });
                        chrome.tabs.onUpdated.removeListener(listener);
                    }
                });
            });
        } catch (error) {
            console.error("Ошибка открытия сайта:", error);
            statusDiv.textContent = "Ошибка открытия сайта: " + error.message;
            speak("Ошибка открытия сайта: " + error.message);
        }

    } else if (lowerCaseText.startsWith('прочитай контент')) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const contentElement = document.querySelector('main') ||
                        document.querySelector('article') ||
                        document.querySelector('#content') ||
                        document.querySelector('.content') ||
                        document.querySelector('.main') ||
                        document.querySelector('#main');

                    if (!contentElement) return null;

                    function extractText(element) {
                        let text = '';
                        for (const node of element.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
                            else if (node.nodeType === Node.ELEMENT_NODE) text += extractText(node);
                        }
                        return text.trim();
                    }

                    return extractText(contentElement);
                }
            });

            if (results && results[0].result) {
                statusDiv.textContent = "Контент: " + results[0].result;
                speak("Контент: " + results[0].result);
            } else {
                throw new Error("Не удалось найти контент на странице");
            }
        } catch (error) {
            console.error("Ошибка чтения контента:", error);
            statusDiv.textContent = "Ошибка чтения контента: " + error.message;
            speak("Ошибка чтения контента: " + error.message);
        }

    } else if (lowerCaseText.startsWith('прочитай навигацию')) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const nav = document.querySelector('nav');
                    if (!nav) return null;

                    function extractText(element) {
                        let text = '';
                        for (const node of element.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
                            else if (node.nodeType === Node.ELEMENT_NODE) text += extractText(node);
                        }
                        return text.trim();
                    }

                    return extractText(nav);
                }
            });

            if (results && results[0].result) {
                statusDiv.textContent = "Навигация: " + results[0].result;
                speak("Навигация: " + results[0].result);
            } else {
                throw new Error("Не удалось найти навигацию на странице");
            }
        } catch (error) {
            console.error("Ошибка чтения навигации:", error);
            statusDiv.textContent = "Ошибка чтения навигации: " + error.message;
            speak("Ошибка чтения навигации: " + error.message);
        }

    } else if (lowerCaseText.startsWith('прочитай подвал')) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const footer = document.querySelector('footer');
                    if (!footer) return null;

                    function extractText(element) {
                        let text = '';
                        for (const node of element.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
                            else if (node.nodeType === Node.ELEMENT_NODE) text += extractText(node);
                        }
                        return text.trim();
                    }

                    return extractText(footer);
                }
            });

            if (results && results[0].result) {
                statusDiv.textContent = "Подвал: " + results[0].result;
                speak("Подвал: " + results[0].result);
            } else {
                throw new Error("Не удалось найти подвал на странице");
            }
        } catch (error) {
            console.error("Ошибка чтения подвала:", error);
            statusDiv.textContent = "Ошибка чтения подвала: " + error.message;
            speak("Ошибка чтения подвала: " + error.message);
        }

    } else if (lowerCaseText.startsWith('как называется сайт')) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const title = tab.title;
            statusDiv.textContent = "Название сайта: " + title;
            speak("Название сайта: " + title);
        } catch (error) {
            console.error("Ошибка получения названия сайта:", error);
            statusDiv.textContent = "Ошибка получения названия сайта: " + error.message;
            speak("Ошибка получения названия сайта: " + error.message);
        }
    } else {
        statusDiv.textContent = "Команда не распознана: " + text;
    }
}

// Функция для получения ссылок и заголовков
function grabLinksAndTitles() {
    const links = document.querySelectorAll("a");
    return Array.from(links)
        .map(link => ({
            link: link.href,
            title: link.textContent.trim()
        }))
        .filter(site => site.link && !site.link.includes("google"));
}

// Обработчики событий
document.getElementById('start').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        const statusDiv = document.getElementById('status');

        let fullTranscript = '';

        recognition.lang = 'ru-RU';
        recognition.interimResults = false;

        mediaRecorder.onstart = () => {
            statusDiv.textContent = "Запись запущена...";
            recognition.start();
        };

        mediaRecorder.onstop = () => {
            statusDiv.textContent = "Запись остановлена. Обработка...";
            recognition.stop();
            processCommand(fullTranscript);
            fullTranscript = '';
        };

        recognition.onresult = (event) => {
            fullTranscript += event.results[event.resultIndex][0].transcript;
        };

        recognition.onerror = (event) => {
            speak(`Ошибка распознавания речи: ${event.error}`);
            console.error("Ошибка распознавания речи:", event.error);
            statusDiv.textContent = "Ошибка распознавания речи: " + event.error;
        };

        mediaRecorder.start();
        document.getElementById('stop').disabled = false;

        document.getElementById('stop').addEventListener('click', () => {
            mediaRecorder.stop();
            document.getElementById('stop').disabled = true;
        }, { once: true });

    } catch (error) {
        speak(`Ошибка доступа к микрофону: ${error}`);
        console.error('Ошибка доступа к микрофону:', error);
        document.getElementById('status').textContent = "Ошибка доступа к микрофону: " + error.message;
    }
});

// Тестирование через текстовый ввод
document.getElementById('textSubmit').addEventListener('click', () => {
    const text = document.getElementById('textInput').value;
    processCommand(text);
});