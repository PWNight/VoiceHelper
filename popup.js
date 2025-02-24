document.getElementById('start').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
        const synth = window.speechSynthesis; // Для синтеза речи
        const statusDiv = document.getElementById('status');

        let fullTranscript = '';

        recognition.lang = 'ru-RU';
        recognition.interimResults = false; // Устанавливаем false, чтобы получать только окончательные результаты

        mediaRecorder.onstart = () => {
            statusDiv.textContent = "Запись запущена...";
            recognition.start();
        };

        mediaRecorder.onstop = () => {
            statusDiv.textContent = "Запись остановлена. Обработка...";
            recognition.stop();
            processCommand(fullTranscript); // Передаем распознанный текст в функцию обработки команд
            fullTranscript = ''; // Очищаем текст
        };

        recognition.onresult = (event) => {
            const transcript = event.results[event.resultIndex][0].transcript;
            fullTranscript += transcript;
            console.log("Распознанный текст (полный):", fullTranscript);
        };

        recognition.onerror = (event) => {
            console.error("Ошибка распознавания речи:", event.error);
            statusDiv.textContent = "Ошибка распознавания речи: " + event.error;
        };

        mediaRecorder.start();
        document.getElementById('stop').disabled = false;

        document.getElementById('stop').addEventListener('click', () => {
            mediaRecorder.stop();
            document.getElementById('stop').disabled = true;
        });

    } catch (error) {
        console.error('Error accessing microphone:', error);
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = "Ошибка доступа к микрофону: " + error.message;
    }
});

document.getElementById('textSubmit').addEventListener('click', () => {
    const text = document.getElementById('textInput').value;
    processCommand(text);
});

async function processCommand(text) {
    const statusDiv = document.getElementById('status');
    const lowerCaseText = text.toLowerCase();
    const synth = window.speechSynthesis; // Для синтеза речи

    function speak(text) { // Функция для озвучивания текста
        const utterance = new SpeechSynthesisUtterance(text);
        synth.speak(utterance);
    }

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
                                let message = "Выберите сайт для открытия:\n";
                                for (let i = 0; i < Math.min(5, sites.length); i++) {
                                    message += `${i + 1}. ${sites[i].title}\n`;
                                }
                                statusDiv.textContent = message;
                                speak(message);

                                document.getElementById('textSubmit').addEventListener('click', function selectListener() {
                                    const selectedSiteTitle = document.getElementById('textInput').value.trim();
                                    const selectedSite = sites.find(site => site.title.toLowerCase() === selectedSiteTitle.toLowerCase());
                                    if (selectedSite) {
                                        chrome.tabs.update({ url: selectedSite.link });
                                        speak("Открываю сайт: " + selectedSite.title);
                                    } else {
                                        statusDiv.textContent = "Некорректный выбор.";
                                        speak("Некорректный выбор.");
                                    }
                                    document.getElementById('textSubmit').removeEventListener('click', selectListener);
                                }, { once: true });
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
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                const tab = tabs[0];
                const response = await fetch(tab.url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const contentElement = doc.querySelector('main') ||
                    doc.querySelector('article') ||
                    doc.querySelector('#content') ||
                    doc.querySelector('.content') ||
                    doc.querySelector('.main') ||
                    doc.querySelector('#main');

                if (!contentElement) {
                    throw new Error("Could not find content element.  Try a different selector.");
                }

                const textContent = extractTextFromElement(contentElement);
                statusDiv.textContent = "Контент: " + textContent;
                speak("Контент: " + textContent);

            });
        } catch (error) {
            console.error("Ошибка чтения контента:", error);
            statusDiv.textContent = "Ошибка чтения контента: " + error.message;
            speak("Ошибка чтения контента: " + error.message);
        }
    } else if (lowerCaseText.startsWith('прочитай навигацию')) {
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                const tab = tabs[0];
                const response = await fetch(tab.url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const nav = doc.querySelector('nav');
                const textContent = extractTextFromElement(nav);
                statusDiv.textContent = "Навигация: " + textContent;
                speak("Навигация: " + textContent);
            });
        } catch (error) {
            console.error("Ошибка чтения навигации:", error);
            statusDiv.textContent = "Ошибка чтения навигации: " + error.message;
            speak("Ошибка чтения навигации: " + error.message);
        }

    } else if (lowerCaseText.startsWith('прочитай подвал')) {
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                const tab = tabs[0];
                const response = await fetch(tab.url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const footer = doc.querySelector('footer');
                const textContent = extractTextFromElement(footer);
                statusDiv.textContent = "Подвал: " + textContent;
                speak("Подвал: " + textContent);
            });
        } catch (error) {
            console.error("Ошибка чтения подвала:", error);
            statusDiv.textContent = "Ошибка чтения подвала: " + error.message;
            speak("Ошибка чтения подвала: " + error.message);
        }
    } else if (lowerCaseText.startsWith('как называется сайт')) {
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                const tab = tabs[0];
                const response = await fetch(tab.url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const title = doc.title;
                statusDiv.textContent = "Название сайта: " + title;
                speak("Название сайта: " + title);
            });
        } catch (error) {
            console.error("Ошибка получения названия сайта:", error);
            statusDiv.textContent = "Ошибка получения названия сайта: " + error.message;
            speak("Ошибка получения названия сайта: " + error.message);
        }
    } else if (lowerCaseText.startsWith('прочитай заголовок')) {
        try {
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                const tab = tabs[0];
                const response = await fetch(tab.url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const title = doc.title;
                statusDiv.textContent = "Заголовок сайта: " + title;
                speak("Заголовок сайта: " + title);
            });
        } catch (error) {
            console.error("Ошибка получения заголовка сайта:", error);
            statusDiv.textContent = "Ошибка получения заголовка сайта: " + error.message;
            speak("Ошибка получения заголовка сайта: " + error.message);
        }
    } else {
        statusDiv.textContent = "Команда не распознана: " + text;
    }
}

function grabLinksAndTitles() {
    const links = document.querySelectorAll("a");
    return Array.from(links)
        .map(link => ({
            link: link.href,
            title: link.textContent.trim() // Получаем заголовок ссылки
        }))
        .filter(site => site.link && !site.link.includes("google"));
}

function extractTextFromElement(element) {
    let textContent = "";
    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            textContent += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            textContent += extractTextFromElement(child);
        }
    }
    return textContent;
}