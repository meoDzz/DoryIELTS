document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const screens = {
        testSelection: document.getElementById('test-selection-screen'),
        infoForm: document.getElementById('info-form-screen'),
        sectionSelection: document.getElementById('section-selection-screen'),
        test: document.getElementById('test-screen'),
        result: document.getElementById('result-screen')
    };
    const testSetSelect = document.getElementById('test-set-select');
    const startTestBtn = document.getElementById('start-test-btn');
    const studentInfoForm = document.getElementById('student-info-form');
    const selectedTestName = document.getElementById('selected-test-name');
    const sectionTitle = document.getElementById('section-title');
    const questionNav = document.getElementById('question-navigation-bar');
    const questionArea = document.getElementById('question-area');
    const timerDisplay = document.getElementById('timer');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    const restartBtn = document.getElementById('restart-btn');
    const audioPlayerContainer = document.getElementById('audio-player-container');
    const resultContainer = document.getElementById('result-content');

    const completedSections = {
        listening: false,
        reading: false,
        writing: false
    };
    // --- State Variables ---
    let testData = null,
        selectedTestSet = null,
        studentInfo = {},
        currentSection = '',
        currentPartIndex = 0,
        userAnswers = {},
        timerInterval;
    let sectionParts = [];
    let allQuestionsInSection = [];

    // --- Initialization ---
    loadTestData();

    // --- Functions ---
    // Fetches test data from the external JSON file
    function loadTestData() {
        fetch('test-data.json')
            .then(response => response.json())
            .then(data => {
                testData = data;
                loadTestSets();
            })
            .catch(error => console.error('Error loading test data:', error));
    }

    function showScreen(screenName) {
        Object.values(screens).forEach(screen => screen.classList.add('hidden'));
        if (screens[screenName]) screens[screenName].classList.remove('hidden');
    }

    function loadTestSets() {
        testSetSelect.innerHTML = '<option value="">-- Chọn một bộ đề --</option>';
        if (testData && testData.testSets) {
            testData.testSets.forEach((testSet, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = testSet.setName;
                testSetSelect.appendChild(option);
            });
        }
        testSetSelect.addEventListener('change', () => {
            if (testSetSelect.value) startTestBtn.classList.remove('hidden');
            else startTestBtn.classList.add('hidden');
        });
        showScreen('testSelection');
    }

    function startTest(section) {
        currentSection = section;
        currentPartIndex = 0;
        userAnswers = {};
        const sectionData = selectedTestSet[section];
        sectionParts = JSON.parse(JSON.stringify(sectionData.parts || []));
        allQuestionsInSection = [];

        questionNav.style.display = 'flex';
        document.getElementById('test-navigation').style.display = 'flex';
        prevBtn.style.display = 'inline-block';
        nextBtn.style.display = 'inline-block';
        submitBtn.style.display = 'inline-block';

        if (section === 'reading') {
            const processedParts = [];
            let currentPassage = null;
            sectionParts.forEach(part => {
                if (part.passage) {
                    currentPassage = part.passage;
                }
                if ((part.questions && part.questions.length > 0) || (part.matching_questions && part.matching_questions.length > 0)) {
                    part.passage = currentPassage;
                    processedParts.push(part);
                }
            });
            sectionParts = processedParts;
        }

        let flatQuestionId = 1;
        const tempSectionParts = (section === 'listening') ? selectedTestSet.listening.parts : sectionParts;
        tempSectionParts.forEach(part => {
            const questionsSource = part.questions || (part.matching_questions ? [part] : []);
            questionsSource.forEach(q => {
                if (q.matching_questions) {
                    q.matching_questions.forEach(mq => {
                        allQuestionsInSection.push({ ...mq, globalId: flatQuestionId++ });
                    });
                } else if (Array.isArray(q.id)) {
                    allQuestionsInSection.push({ ...q, globalId: flatQuestionId++ });
                }
                else if (q.id) {
                    allQuestionsInSection.push({ ...q, globalId: flatQuestionId++ });
                }
            });
        });

        showScreen('test');
        sectionTitle.textContent = sectionData.title;

        if (section === 'listening') {
            renderAllListeningParts();
        } else {
            renderCurrentPart();
        }
        startTimer(sectionData.timeLimit);
    }

    function renderCurrentPart() {
        if (currentPartIndex < 0 || currentPartIndex >= sectionParts.length) return;
        const partData = sectionParts[currentPartIndex];
        questionArea.innerHTML = '';
        audioPlayerContainer.innerHTML = '';

        let partStartIndex = 0;
        for (let i = 0; i < currentPartIndex; i++) {
            const part = sectionParts[i];
            if (part.questions) {
                part.questions.forEach(q => {
                    if (q.matching_questions) {
                        partStartIndex += q.matching_questions.length;
                    } else if (Array.isArray(q.id)) {
                        partStartIndex += 1;
                    } else {
                        partStartIndex += 1;
                    }
                });
            } else if (part.matching_questions) {
                partStartIndex += part.matching_questions.length;
            }
        }

        const partCard = createQuestionCard(partData, partStartIndex);
        questionArea.appendChild(partCard);

        renderPartNav();
        updateNavigationButtons();
    }

    function renderAllListeningParts() {
        questionNav.style.display = 'none';
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'block';
        audioPlayerContainer.innerHTML = '';

        const listeningData = selectedTestSet.listening;
        questionArea.innerHTML = '';
        let globalQuestionIndex = 0;

        listeningData.parts.forEach(part => {
            const partCard = createQuestionCard(part, globalQuestionIndex);
            questionArea.appendChild(partCard);

            const questionsSource = part.questions || (part.matching_questions ? [part] : []);
            questionsSource.forEach(q => {
                if (q.matching_questions) {
                    globalQuestionIndex += q.matching_questions.length;
                } else if (Array.isArray(q.id)) {
                    globalQuestionIndex += 1;
                } else if (q.id) {
                    globalQuestionIndex += 1;
                }
            });
        });
    }


    function createQuestionCard(part, startIndex = 0) {
        const card = document.createElement('div');
        card.className = 'question-card';

        if (part.audio && currentSection === 'listening') {
            card.innerHTML += `<div class="audio-player-container-per-part" style="text-align:center; margin-bottom: 15px;">
                                  <p class="instructions">Bạn sẽ chỉ được nghe một lần duy nhất. Nhấn play để bắt đầu.</p>
                                  <audio controls style="width:100%;"><source src="${part.audio}" type="audio/mpeg">Trình duyệt của bạn không hỗ trợ âm thanh.</audio>
                              </div>`;
        }

        if (part.partTitle) card.innerHTML += `<h3>${part.partTitle}</h3>`;
        if (part.passage) card.innerHTML += `<div class="passage">${part.passage}</div>`;
        if (part.image) card.innerHTML += `<img src="${part.image}" alt="Question Image" class="question-image">`;
        if (part.instructions) card.innerHTML += `<p class="instructions">${part.instructions}</p>`;

        let questionCounterInPart = 0;
        const questionsSource = part.questions || (part.matching_questions ? [part] : []);

        if (part.type === 'html_template') {
            let template = part.html_template;
            const container = document.createElement('div');
            container.className = 'html-template-container';

            part.questions.forEach((q) => {
                const globalIndex = startIndex + questionCounterInPart;
                const placeholder = `[BLANK_${q.id}]`;

                if (q.type === 'select') {
                    const optionsHtml = q.options.map(opt => `<option value="${opt}" ${userAnswers[globalIndex] === opt ? 'selected' : ''}>${opt}</option>`).join('');
                    template = template.replace(placeholder, `<select id="q_${globalIndex}" data-global-index="${globalIndex}"><option value="">-</option>${optionsHtml}</select>`);
                } else {
                    template = template.replace(placeholder, `<input type="text" id="q_${globalIndex}" value="${userAnswers[globalIndex] || ''}" data-global-index="${globalIndex}" autocomplete="off">`);
                }
                questionCounterInPart++;
            });
            container.innerHTML = template;
            card.appendChild(container);
        }
        else if (questionsSource.length > 0) {
            let lastInstructions = "";
            questionsSource.forEach(q_block => {
                const questionElement = document.createElement('div');
                questionElement.className = 'question-item';

                if (q_block.instructions && q_block.instructions !== lastInstructions) {
                    questionElement.innerHTML += `<p class="instructions">${q_block.instructions}</p>`;
                    lastInstructions = q_block.instructions;
                }

                if (q_block.type === 'matching_inline') {
                    let optionsBox = '<div class="matching-options-box"><ul>';
                    q_block.options.forEach(opt => { optionsBox += `<li>${opt.text}</li>`; });
                    optionsBox += '</ul></div>';

                    questionElement.innerHTML += optionsBox;
                }

                if (q_block.questionText) {
                    questionElement.innerHTML += `<p><b>${q_block.questionText}</b></p>`;
                }

                if (q_block.type === 'writing') {
                    const globalIndex = startIndex + questionCounterInPart;

                    // Thiết lập ngưỡng từ tối thiểu theo từng task
                    const minWords = (globalIndex === 0) ? 150 : 250;

                    questionElement.innerHTML += `
                                <textarea 
                                    id="q_${globalIndex}" 
                                    data-global-index="${globalIndex}" 
                                    class="writing-input" 
                                    placeholder="Nhập câu trả lời của bạn tại đây...">${userAnswers[globalIndex] || ''}</textarea>
                                <div class="word-count" id="word-count-${globalIndex}" style="text-align: right; font-size: 0.9em; color: #555;">
                                    Words: 0 (min: ${minWords})
                                </div>
                            `;

                    setTimeout(() => {
                        const textarea = document.getElementById(`q_${globalIndex}`);
                        const wordCountElement = document.getElementById(`word-count-${globalIndex}`);

                        const countWords = (text) => {
                            const cleaned = text.trim().replace(/\s+/g, ' ');
                            return cleaned === '' ? 0 : cleaned.split(' ').length;
                        };

                        const updateWordCount = () => {
                            const count = countWords(textarea.value);
                            wordCountElement.textContent = `Words: ${count} (min: ${minWords})`;

                            if (count < minWords) {
                                textarea.style.color = 'black';
                                wordCountElement.style.color = 'green';
                            } else {
                                textarea.style.color = 'red';
                                wordCountElement.style.color = 'red';
                            }
                        };

                        textarea.addEventListener('input', updateWordCount);
                        updateWordCount();
                    }, 0);

                    questionCounterInPart++;
                }

                else if (q_block.matching_questions) {
                    q_block.matching_questions.forEach(mq => {
                        const globalIndex = startIndex + questionCounterInPart;
                        const item = document.createElement('div');
                        item.className = 'matching-stem-item';
                        const optionsHtml = q_block.options.map(opt => `<option value="${opt.value}" ${userAnswers[globalIndex] === opt.value ? 'selected' : ''}>${opt.value}</option>`).join('');
                        item.innerHTML = `<label for="q_${globalIndex}">${mq.questionText}</label><select id="q_${globalIndex}" data-global-index="${globalIndex}"><option value="">Select</option>${optionsHtml}</select>`;
                        questionElement.appendChild(item);
                        questionCounterInPart++;
                    });
                }
                else if (q_block.options) {
                    const globalIndex = startIndex + questionCounterInPart;
                    const optionsContainer = document.createElement('div');
                    optionsContainer.className = 'options-container';
                    const inputType = q_block.multiSelect ? 'checkbox' : 'radio';
                    const questionId = Array.isArray(q_block.id) ? q_block.id.join('-') : q_block.id;

                    q_block.options.forEach(optionText => {
                        const optionValue = String(optionText).split('.')[0].trim();
                        const isChecked = Array.isArray(userAnswers[globalIndex]) ? userAnswers[globalIndex].includes(optionValue) : userAnswers[globalIndex] === optionValue;
                        optionsContainer.innerHTML += `<label><input type="${inputType}" name="q_${questionId}" value="${optionValue}" data-global-index="${globalIndex}" ${isChecked ? 'checked' : ''}> <span>${optionText}</span></label>`;
                    });
                    questionElement.appendChild(optionsContainer);
                    questionCounterInPart++;
                }

                if (questionElement.innerHTML.trim() !== "") {
                    card.appendChild(questionElement);
                }
            });
        }

        card.querySelectorAll('input, select, textarea').forEach(el => {
            const index = parseInt(el.dataset.globalIndex, 10);
            if (isNaN(index)) return;

            const eventType = (el.type === 'text' || el.tagName.toLowerCase() === 'textarea') ? 'input' : 'change';

            el.addEventListener(eventType, (e) => {
                if (e.target.type === 'checkbox') {
                    let answers = userAnswers[index] || [];
                    if (e.target.checked) {
                        if (!answers.includes(e.target.value)) answers.push(e.target.value);
                    } else {
                        answers = answers.filter(a => a !== e.target.value);
                    }
                    userAnswers[index] = answers.sort();
                } else {
                    userAnswers[index] = e.target.value;
                }

                if (eventType === 'change' && currentSection !== 'listening') {
                    renderPartNav();
                }
            });
            if ((el.type === 'text' || el.tagName.toLowerCase() === 'textarea') && currentSection !== 'listening') {
                el.addEventListener('blur', renderPartNav);
            }
        });

        return card;
    }

    function renderPartNav() {
        questionNav.innerHTML = '';
        let questionCounter = 0;

        sectionParts.forEach((part, index) => {
            let numQuestionsInPart = 0;

            if (part.questions) {
                part.questions.forEach(q => {
                    if (q.matching_questions) {
                        numQuestionsInPart += q.matching_questions.length;
                    } else if (Array.isArray(q.id)) {
                        numQuestionsInPart += 1;
                    } else {
                        numQuestionsInPart += 1;
                    }
                });
            } else if (part.matching_questions) {
                numQuestionsInPart = part.matching_questions.length;
            }

            const navBtn = document.createElement('button');
            navBtn.className = 'nav-q-btn';
            navBtn.textContent = part.partTitle;

            if (index === currentPartIndex) navBtn.classList.add('current');

            let allAnswered = numQuestionsInPart > 0;
            for (let i = 0; i < numQuestionsInPart; i++) {
                const answer = userAnswers[questionCounter + i];
                if (answer === undefined || answer === null || String(answer).trim() === '' || (Array.isArray(answer) && answer.length === 0)) {
                    allAnswered = false;
                    break;
                }
            }
            if (allAnswered) navBtn.classList.add('answered');
            navBtn.onclick = () => {
                currentPartIndex = index;
                renderCurrentPart();
            };
            questionNav.appendChild(navBtn);
            questionCounter += numQuestionsInPart;
        });
    }

    function updateNavigationButtons() {
        prevBtn.disabled = currentPartIndex === 0;
        nextBtn.disabled = currentPartIndex >= sectionParts.length - 1;
        submitBtn.style.display = currentPartIndex >= sectionParts.length - 1 ? 'inline-block' : 'none';
    }

    function goNext() {
        if (currentPartIndex < sectionParts.length - 1) {
            currentPartIndex++;
            renderCurrentPart();
        }
    }

    function goPrev() {
        if (currentPartIndex > 0) {
            currentPartIndex--;
            renderCurrentPart();
        }
    }

    function startTimer(durationInSeconds) {
        clearInterval(timerInterval);
        let timer = durationInSeconds;
        timerInterval = setInterval(() => {
            if (!timerDisplay) return;
            const minutes = parseInt(timer / 60, 10);
            const seconds = parseInt(timer % 60, 10);
            timerDisplay.textContent = `Time: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            if (--timer < 0) {
                clearInterval(timerInterval);
                timerDisplay.textContent = "Time's up!";
                if (screens.test.classList.contains('hidden') === false) {
                    handleSubmit();
                }
            }
        }, 1000);
    }

    function calculateScore() {
        if (currentSection === 'writing') {
            return { writingResponses: userAnswers };
        }

        let correctCount = 0;
        let incorrectCount = 0;
        let unansweredCount = 0;

        const resultDetails = allQuestionsInSection.map((question, index) => {
            const userAnswer = userAnswers[index];
            const correctAnswer = question.answer;
            const isCorrect = isAnswerCorrect(userAnswer, correctAnswer);

            if (userAnswer === undefined || userAnswer === null || (Array.isArray(userAnswer) && userAnswer.length === 0) || (typeof userAnswer === 'string' && userAnswer.trim() === '')) {
                unansweredCount++;
            } else if (isCorrect) {
                correctCount++;
            } else {
                incorrectCount++;
            }
            return {
                questionNumber: question.id,
                userAnswer: userAnswer,
                correctAnswer: correctAnswer,
                isCorrect: isCorrect
            };
        });
        return { correctCount, incorrectCount, unansweredCount, resultDetails };
    }

    function isAnswerCorrect(userAnswer, correctAnswer) {
        if (userAnswer === undefined || userAnswer === null) return false;
        const format = (ans) => String(ans).toLowerCase().trim().replace(/\.$/, '');

        if (Array.isArray(correctAnswer)) {
            if (!Array.isArray(userAnswer) || userAnswer.length !== correctAnswer.length) {
                return false;
            }
            const sortedUserAnswer = [...userAnswer].map(format).sort();
            const sortedCorrectAnswer = [...correctAnswer].map(format).sort();
            return JSON.stringify(sortedUserAnswer) === JSON.stringify(sortedCorrectAnswer);
        } else {
            const user = format(userAnswer);
            const correct = format(correctAnswer);
            if (['true', 'false', 'not given', 'yes', 'no'].includes(correct)) {
                return user.charAt(0) === correct.charAt(0);
            }
            return user === correct;
        }
    }

    function handleSubmit() {
        clearInterval(timerInterval);
        const scoreData = calculateScore();

        let feedbackHTML = `<h2>Results for ${selectedTestSet.setName} - ${currentSection.charAt(0).toUpperCase() + currentSection.slice(1)}</h2>`;
        if (currentSection === 'writing') {
            feedbackHTML += `<p class="instructions">Your writing responses have been saved. Please copy them for submission.</p>`;
            Object.values(scoreData.writingResponses).forEach((response, index) => {
                feedbackHTML += `
                    <div class="question-card">
                        <h3>Task ${index + 1} Response</h3>
                         <textarea class="writing-input" readonly>${response}</textarea>
                    </div>
                `;
            });
        } else {
            feedbackHTML += `
                <div class="result-summary">
                    <p class="correct"><strong>Correct:</strong> ${scoreData.correctCount}</p>
                    <p class="incorrect"><strong>Incorrect:</strong> ${scoreData.incorrectCount}</p>
                   <p class="unanswered"><strong>Unanswered:</strong> ${scoreData.unansweredCount}</p>
                </div>
                <h3>Detailed Results</h3>
                <table>
                     <thead>
                        <tr>
                            <th>Question</th>
                            <th>Your Answer</th>
                            <th>Correct Answer</th>
                            <th>Status</th>
                        </tr>
                     </thead>
                    <tbody>
            `;
            scoreData.resultDetails.forEach(detail => {
                const status = detail.isCorrect ? '<span style="color: green; font-weight: bold;">Correct</span>' : (detail.userAnswer ? '<span style="color: red;">Incorrect</span>' : '<em>Unanswered</em>');
                const userAnswerText = Array.isArray(detail.userAnswer) ? detail.userAnswer.join(', ') : (detail.userAnswer || '—');
                const correctAnswerText = Array.isArray(detail.correctAnswer) ? detail.correctAnswer.join(', ') : detail.correctAnswer;
                const qNumberText = Array.isArray(detail.questionNumber) ? detail.questionNumber.join(' & ') : detail.questionNumber;

                feedbackHTML += `
                    <tr>
                        <td>${qNumberText}</td>
                        <td>${userAnswerText}</td>
                        <td>${correctAnswerText}</td>
                        <td>${status}</td>
                 </tr>
                `;
            });

            feedbackHTML += '</tbody></table>';
        }

        resultContainer.innerHTML = feedbackHTML;
        completedSections[currentSection] = true;
        showScreen('result');
    }
    function countWords(text) {
        const cleaned = text.trim().replace(/\s+/g, ' ');
        return cleaned === '' ? 0 : cleaned.split(' ').length;
    }
    // --- Event Listeners ---
    startTestBtn.addEventListener('click', () => {
        const selectedIndex = testSetSelect.value;
        if (!selectedIndex) {
            alert('Vui lòng chọn một bộ đề.');
            return;
        }
        selectedTestSet = testData.testSets[selectedIndex];
        selectedTestName.textContent = selectedTestSet.setName;
        showScreen('infoForm');
    });
    studentInfoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        studentInfo = {
            fullName: e.target.fullName.value,
            className: e.target.className.value,
            dob: e.target.dob.value,
            phone: e.target.phone.value,
            email: e.target.email.value
        };
        showScreen('sectionSelection');
    });
    document.querySelectorAll('#section-selection-screen .section-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            if (section && selectedTestSet) {
                startTest(section);
            }
        });
    });

    restartBtn.addEventListener('click', () => {
        showScreen("sectionSelection");
        document.getElementById("selected-test-name").textContent = selectedTestSet.setName;

        // Cập nhật hiển thị trạng thái đã làm
        const sectionButtons = document.querySelectorAll('.section-btn');
        sectionButtons.forEach(btn => {
            const section = btn.dataset.section;
            if (completedSections[section]) {
                btn.innerText = btn.innerText.replace(" (Done)", ""); // tránh lặp
                btn.innerText += " (Done)";
                btn.disabled = true; // hoặc bạn có thể không disable
            }
        });
    });
    prevBtn.addEventListener('click', goPrev);
    nextBtn.addEventListener('click', goNext);
    submitBtn.addEventListener('click', handleSubmit);
});