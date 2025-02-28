// Ивент по нажатию на кнопку начать запись
document.getElementById('start').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
        const statusDiv = document.getElementById('status');

        let fullTranscript = '';

        recognition.lang = 'ru-RU';
        recognition.interimResults = false;

        // Обновляем статус при старте записи
        mediaRecorder.onstart = () => {
            statusDiv.textContent = "Запись запущена...";
            recognition.start();
        };

        // Обновляем статус при остановке записи и отправляем результат в обработчик команд
        mediaRecorder.onstop = () => {
            statusDiv.textContent = "Запись остановлена. Обработка...";
            recognition.stop();
            processCommand(fullTranscript);
            fullTranscript = '';
        };

        // При распознавании сообщения записываем текст в переменную
        recognition.onresult = (event) => {
            const transcript = event.results[event.resultIndex][0].transcript;
            fullTranscript += transcript;
        };

        // Выводим ошибку в консоль при ошибке
        // TODO: Написать озвучивание ошибки
        recognition.onerror = (event) => {
            console.error("Ошибка распознавания речи:", event.error);
            statusDiv.textContent = "Ошибка распознавания речи: " + event.error;
        };

        // Запускаем запись голоса и включаем возможность нажать на кнопку остановки
        mediaRecorder.start();
        document.getElementById('stop').disabled = false;

        // При нажатии на остановку завершаем запись голоса и отключаем кнопку остановки
        document.getElementById('stop').addEventListener('click', () => {
            mediaRecorder.stop();
            document.getElementById('stop').disabled = true;
        });

    } catch (error) {
        // Выводим ошибку в консоль и в статус
        // TODO: Сделать озвучивание ошибки
        console.error('Error accessing microphone:', error);
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = "Ошибка доступа к микрофону: " + error.message;
    }
});

// ДЛЯ ТЕСТИРОВАНИЯ
// При нажатии на кнопку отправи отправляем текст из инпута в обработчик
document.getElementById('textSubmit').addEventListener('click', () => {
    const text = document.getElementById('textInput').value;
    processCommand(text);
});

// Функция для обработки команды
async function processCommand(text) {
    const statusDiv = document.getElementById('status');
    const lowerCaseText = text.toLowerCase();
    const synth = window.speechSynthesis;

    // Функция для озвучивания текста
    function speak(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        synth.speak(utterance);
    }

    // Действия при команде открыть сайт
    if (lowerCaseText.startsWith('открой сайт')) {
        const searchTerm = lowerCaseText.substring('открой сайт'.length).trim();
        if (searchTerm === "") {
            statusDiv.textContent = "Не указан поисковый запрос.";
            speak("Не указан поисковый запрос.");
            return;
        }

        try {
            // Выполняем поиск в гугле по запросу от пользователя
            const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
            chrome.tabs.update({ url: googleSearchUrl }, () => {
                // Добавляем слушатель загрузки страницы
                chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
                    // При завершении загрузки страницы продолжаем логику
                    if (changeInfo.status === 'complete' && tab.url === googleSearchUrl) {
                        // Выполняем функцию grabLinksAndTitles на странице поиска
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            function: grabLinksAndTitles
                        }, (results) => {
                            // При возникновении ошибки выводим её в консоль
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                return;
                            }
                            // Получаем список сайтов
                            const sites = results && results[0] && results[0].result ? results[0].result : [];
                            if (sites.length > 0) {
                                // Предлагаем выбрать какой из первых 5 результатов поиска открыть
                                let message = "Выберите сайт для открытия (назовите цифру от 1 до 5)";
                                for (let i = 0; i < Math.min(5, sites.length); i++) {
                                    message += `${i + 1}. ${sites[i].title}\n`;
                                }
                                statusDiv.textContent = message;
                                speak(message);

                                // TODO: Переписать код ниже под голосовой ввод
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
            // При ошибке выводим её в консоль и озвучиваем
            console.error("Ошибка открытия сайта:", error);
            statusDiv.textContent = "Ошибка открытия сайта: " + error.message;
            speak("Ошибка открытия сайта: " + error.message);
        }
    // Действия при команде прочитать контент в подвале
    // TODO: проверить работоспособность и переписать код
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
    // Действия при команде прочитать контент в навигации
    // TODO: проверить работоспособность и переписать код
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
    // Действия при команде прочитать контент в подвале
    // TODO: проверить работоспособность и переписать код
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
    // Действия при команде прочитать название сайта
    } else if (lowerCaseText.startsWith('как называется сайт')) {
        try {
            // Получаем текущее окно
            chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
                const tab = tabs[0];
                const response = await fetch(tab.url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                // Парсим html код страницы
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Озвучиваем название сайта
                const title = doc.title;
                statusDiv.textContent = "Название сайта: " + title;
                speak("Название сайта: " + title);
            });
        } catch (error) {
            // При ошибке выводим её в консоль и овзучиваем
            console.error("Ошибка получения названия сайта:", error);
            statusDiv.textContent = "Ошибка получения названия сайта: " + error.message;
            speak("Ошибка получения названия сайта: " + error.message);
        }
    } else {
        statusDiv.textContent = "Команда не распознана: " + text;
    }
}

// Функция для получения всех ссылок на странице поиска, за исключением гугл ссылок
function grabLinksAndTitles() {
    const links = document.querySelectorAll("a");
    return Array.from(links)
        .map(link => ({
            link: link.href,
            title: link.textContent.trim() // Получаем заголовок ссылки
        }))
        .filter(site => site.link && !site.link.includes("google"));
}

// Функция для получения контента на странице из элемента
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