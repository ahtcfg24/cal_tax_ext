document.addEventListener('DOMContentLoaded', function() {
    // 社保公积金参数（2025-2026），会在切换城市时动态覆盖
    const SOCIAL_PARAMS = {
        baseMin: 7460,        // 社保基数下限
        baseMax: 37302,       // 社保基数上限
        pensionRatio: 0.08,   // 养老保险个人比例
        medicalRatio: 0.02,   // 医疗保险个人比例
        unemploymentRatio: 0.005, // 失业保险个人比例
    };

    const FUND_PARAMS = {
        baseMin: 7460,        // 公积金基数下限
        baseMax: 37302,       // 公积金基数上限
    };

    // 城市数据（从 merged_city_data.json 加载）
    let CITY_DATA = {};

    // 下拉选项 value -> JSON 中的城市名映射
    const CITY_KEY_MAP = {
        beijing: '北京市',
        shanghai: '上海市',
        tianjin: '天津市',
        chongqing: '重庆市',
        shijiazhuang: '石家庄市',
        taiyuan: '太原市',
        huhehaote: '呼和浩特市',
        shenyang: '沈阳市',
        changchun: '长春市',
        haerbin: '哈尔滨市',
        nanjing: '南京市',
        hangzhou: '杭州市',
        hefei: '合肥市',
        fuzhou: '福州市',
        nanchang: '南昌市',
        jinan: '济南市',
        zhengzhou: '郑州市',
        wuhan: '武汉市',
        changsha: '长沙市',
        guangzhou: '广州市',
        nanning: '南宁市',
        haikou: '海口市',
        chengdu: '成都市',
        guiyang: '贵阳市',
        kunming: '昆明市',
        lasa: '拉萨市',
        xian: '西安市',
        lanzhou: '兰州市',
        xining: '西宁市',
        yinchuan: '银川市',
        wulumuqi: '乌鲁木齐市',
        dalian: '大连市',
        qingdao: '青岛市',
        ningbo: '宁波市',
        xiamen: '厦门市',
        shenzhen: '深圳市',
        other: '其他城市',
    };

    // 部分城市的医疗固定额兜底（数据文件中未提供的情况下使用）
    const CITY_MEDICAL_FIXED_FALLBACK = {};

    // 个税预扣率表（年度）
    const ANNUAL_TAX_RATE_TABLE = [
        { threshold: 0, rate: 0.03, deduction: 0 },
        { threshold: 36000, rate: 0.1, deduction: 2520 },
        { threshold: 144000, rate: 0.2, deduction: 16920 },
        { threshold: 300000, rate: 0.25, deduction: 31920 },
        { threshold: 420000, rate: 0.3, deduction: 52920 },
        { threshold: 660000, rate: 0.35, deduction: 85920 },
        { threshold: 960000, rate: 0.45, deduction: 181920 },
    ];

    // 年终奖单独计税月度税率表
    const MONTHLY_TAX_TABLE = [
        { threshold: 0, rate: 0.03, deduction: 0 },
        { threshold: 3000, rate: 0.1, deduction: 210 },
        { threshold: 12000, rate: 0.2, deduction: 1410 },
        { threshold: 25000, rate: 0.25, deduction: 2660 },
        { threshold: 35000, rate: 0.3, deduction: 4410 },
        { threshold: 55000, rate: 0.35, deduction: 7160 },
        { threshold: 80000, rate: 0.45, deduction: 15160 },
    ];

    // DOM元素
    const monthlySalaryInput = document.getElementById('monthlySalary');
    const specialDeductionInput = document.getElementById('specialDeduction');
    const socialBaseInput = document.getElementById('socialBase');
    const fundBaseInput = document.getElementById('fundBase');
    const fundRatio = document.getElementById('fundRatio');
    const fundRatioValue = document.getElementById('fundRatioValue');
    const companyFundRatio = document.getElementById('companyFundRatio');
    const companyFundRatioValue = document.getElementById('companyFundRatioValue');
    const socialRatioHint = document.getElementById('socialRatioHint');
    const customSocialGroup = document.getElementById('customSocialGroup');
    const otherPensionRatioInput = document.getElementById('otherPensionRatio');
    const otherMedicalRatioInput = document.getElementById('otherMedicalRatio');
    const otherUnemploymentRatioInput = document.getElementById('otherUnemploymentRatio');
    const salaryForm = document.getElementById('salaryForm');
    const resultContainer = document.getElementById('resultContainer');
    const initialPrompt = document.getElementById('initialPrompt');
    const monthsTableBody = document.getElementById('monthsTableBody');
    const annualDetail = document.getElementById('annualDetail');
    const bonusMonthText = document.getElementById('bonusMonthText');
    const yearBonusInput = document.getElementById('yearBonus');
    const bonusMonthSelect = document.getElementById('bonusMonth');
    const bonusTaxRadios = document.querySelectorAll('input[name="bonusTaxType"]');
    const bonusMonthHint = document.getElementById('bonusMonthHint');

    // 专项附加扣除相关元素
    const deductionCheckboxes = document.querySelectorAll('input[type="checkbox"][data-type]');
    
    // 快速年终奖按钮
    const quickBonusButtons = document.querySelectorAll('.quick-bonus-group button');

    // 公积金比例滑块事件
    if(fundRatio) {
        fundRatio.addEventListener('input', () => {
            fundRatioValue.textContent = `${fundRatio.value}%`;
            // 同步更新公司比例，通常默认一致，但也允许手动调
            // 这里策略：如果用户没手动动过公司比例，则跟随；简单起见，先不做联动，让用户分别调
        });
    }
    
    if(companyFundRatio) {
        companyFundRatio.addEventListener('input', () => {
            companyFundRatioValue.textContent = `${companyFundRatio.value}%`;
        });
    }

    // 快速年终奖按钮事件
    quickBonusButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission
            const months = parseFloat(btn.dataset.months) || 0;
            const monthlySalary = parseFloat(monthlySalaryInput.value) || 0;
            if (monthlySalary > 0) {
                yearBonusInput.value = Math.floor(monthlySalary * months);
            }
        });
    });

    // 实时调整社保基数输入
    if(socialBaseInput) {
        socialBaseInput.addEventListener('blur', () => {
             validateBaseInput(socialBaseInput, SOCIAL_PARAMS.baseMin, SOCIAL_PARAMS.baseMax);
        });
    }

    // 实时调整公积金基数输入
    if(fundBaseInput) {
        fundBaseInput.addEventListener('blur', () => {
            validateBaseInput(fundBaseInput, FUND_PARAMS.baseMin, FUND_PARAMS.baseMax);
        });
    }

    // 监听税前月薪输入，自动更新社保/公积金基数
    if(monthlySalaryInput) {
        monthlySalaryInput.addEventListener('input', () => {
            updateBaseInputs();
        });
    }

    // 监听城市选择变化并加载城市数据
    const cityTierSelect = document.getElementById('cityTier');
    const rentDeductionCheckbox = document.querySelector('input[data-type="rent"]');

    // 加载城市数据后，初始化当前城市配置
    loadCityData().then(() => {
        if (cityTierSelect) {
            applyCityData(cityTierSelect.value);
        }
    });

    if(cityTierSelect) {
        cityTierSelect.addEventListener('change', () => {
            applyCityData(cityTierSelect.value);
            updateRentDeduction();
            updateBaseInputs(); // 城市切换后，基数重新适配
        });
    }

    // 其他城市自定义比例变更时刷新配置
    [otherPensionRatioInput, otherMedicalRatioInput, otherUnemploymentRatioInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                if (cityTierSelect && cityTierSelect.value === 'other') {
                    applyCityData('other');
                    updateBaseInputs();
                }
            });
        }
    });

    function loadCityData() {
        const url = chrome.runtime.getURL('merged_city_data.json');
        return fetch(url)
            .then(res => res.json())
            .then(data => {
                CITY_DATA = data || {};
            })
            .catch(() => {
                CITY_DATA = {};
            });
    }

    function applyCityData(selectValue) {
        const cityName = CITY_KEY_MAP[selectValue] || '上海市';
        const isCustomCity = cityName === '其他城市';
        toggleCustomSocial(isCustomCity);

        if (isCustomCity) {
            // 自定义城市：不限基数范围，比例来自输入框
            SOCIAL_PARAMS.baseMin = 0;
            SOCIAL_PARAMS.baseMax = Number.MAX_SAFE_INTEGER;
            FUND_PARAMS.baseMin = 0;
            FUND_PARAMS.baseMax = Number.MAX_SAFE_INTEGER;

            const pension = getCustomRatio(otherPensionRatioInput, 0.08);
            const medical = getCustomRatio(otherMedicalRatioInput, 0.02);
            const unemployment = getCustomRatio(otherUnemploymentRatioInput, 0.005);

            SOCIAL_PARAMS.pensionRatio = pension;
            SOCIAL_PARAMS.medicalRatio = medical;
            SOCIAL_PARAMS.medicalFixed = 0;
            SOCIAL_PARAMS.unemploymentRatio = unemployment;

            // 提示文案与输入范围
            setBaseRangeHint('不限');

            updateSocialRatioHint({
                pension,
                medicalRatio: medical,
                medicalFixed: 0,
                unemployment
            });
            return;
        }

        const data = CITY_DATA[cityName];
        if (!data) return;

        // 解析社保、公积金基数
        const socialMin = parseFloat(data.social_security_base_lower_limit) || SOCIAL_PARAMS.baseMin;
        const socialMax = parseFloat(data.social_security_base_upper_limit) || SOCIAL_PARAMS.baseMax;
        const fundMin = parseFloat(data.housing_fund_base_lower_limit) || FUND_PARAMS.baseMin;
        const fundMax = parseFloat(data.housing_fund_base_upper_limit) || FUND_PARAMS.baseMax;

        SOCIAL_PARAMS.baseMin = socialMin;
        SOCIAL_PARAMS.baseMax = socialMax;
        FUND_PARAMS.baseMin = fundMin;
        FUND_PARAMS.baseMax = fundMax;

        // 解析比例，支持“2%+3”形式
        const pension = parseRatio(data.endowment_insurance_ratio, 0.08);
        const medicalParsed = parseRatioFixed(data.medical_insurance_ratio, 0.02);
        const unemployment = parseRatio(data.unemployment_insurance_ratio, 0.005);

        SOCIAL_PARAMS.pensionRatio = pension;
        SOCIAL_PARAMS.medicalRatio = medicalParsed.ratio;
        // 如果城市未提供固定额，重置为0（避免沿用上一城市的固定额）
        SOCIAL_PARAMS.medicalFixed = medicalParsed.fixed != null ? medicalParsed.fixed : (CITY_MEDICAL_FIXED_FALLBACK[cityName] || 0);
        SOCIAL_PARAMS.unemploymentRatio = unemployment;

        // 更新输入框的最小/最大值提示
        if (socialBaseInput) {
            socialBaseInput.min = socialMin;
            socialBaseInput.max = socialMax;
            const hint = socialBaseInput.closest('.form-group')?.querySelector('.hint');
            if (hint) hint.textContent = `范围：${socialMin}-${socialMax}元`;
        }
        if (fundBaseInput) {
            fundBaseInput.min = fundMin;
            fundBaseInput.max = fundMax;
            const hint = fundBaseInput.closest('.form-group')?.querySelector('.hint');
            if (hint) hint.textContent = `范围：${fundMin}-${fundMax}元`;
        }

        updateSocialRatioHint({
            pension,
            medicalRatio: SOCIAL_PARAMS.medicalRatio,
            medicalFixed: SOCIAL_PARAMS.medicalFixed,
            unemployment
        });
    }

    function toggleCustomSocial(show) {
        if (!customSocialGroup) return;
        customSocialGroup.classList.toggle('hidden', !show);
    }

    function getCustomRatio(input, fallback) {
        if (!input) return fallback;
        const val = parseFloat(input.value);
        if (isNaN(val)) return fallback;
        return val / 100;
    }

    function setBaseRangeHint(text) {
        if (socialBaseInput) {
            socialBaseInput.removeAttribute('min');
            socialBaseInput.removeAttribute('max');
            const hint = socialBaseInput.closest('.form-group')?.querySelector('.hint');
            if (hint) hint.textContent = `范围：${text}`;
        }
        if (fundBaseInput) {
            fundBaseInput.removeAttribute('min');
            fundBaseInput.removeAttribute('max');
            const hint = fundBaseInput.closest('.form-group')?.querySelector('.hint');
            if (hint) hint.textContent = `范围：${text}`;
        }
    }

    function updateSocialRatioHint({ pension, medicalRatio, medicalFixed, unemployment }) {
        if (!socialRatioHint) return;
        const formatPercentShort = (ratio) => {
            if (ratio === undefined || ratio === null || isNaN(ratio)) return '--';
            const val = ratio * 100;
            return val % 1 === 0 ? val.toFixed(0) + '%' : val.toFixed(2).replace(/\.?0+$/, '') + '%';
        };
        const formatFixedShort = (num) => {
            if (num === undefined || num === null || isNaN(num) || num <= 0) return '';
            return Number(num).toFixed(2).replace(/\.?0+$/, '');
        };
        const medFixed = medicalFixed || 0;
        const medicalPart = medFixed > 0
            ? `${formatPercentShort(medicalRatio)}+${formatFixedShort(medFixed)}元`
            : `${formatPercentShort(medicalRatio)}`;
        socialRatioHint.textContent = `当前城市社保个人缴纳比例：养老${formatPercentShort(pension)}、医疗${medicalPart}、失业${formatPercentShort(unemployment)}`;
    }

    function parseRatio(value, fallback = 0) {
        if (!value) return fallback;
        const match = String(value).match(/([0-9.]+)%?/);
        if (match) return parseFloat(match[1]) / 100;
        return fallback;
    }

    function parseRatioFixed(value, fallbackRatio = 0, fallbackFixed = null) {
        if (!value) return { ratio: fallbackRatio, fixed: fallbackFixed };
        const match = String(value).match(/([0-9.]+)%?(?:\+([0-9.]+))?/);
        const ratio = match && match[1] ? parseFloat(match[1]) / 100 : fallbackRatio;
        const fixed = match && match[2] ? parseFloat(match[2]) : fallbackFixed;
        return { ratio, fixed };
    }

    function updateRentDeduction() {
        // 目前租金标准固定 1500，未来如需按城市调整，可在此扩展
        updateSpecialDeduction();
    }

    function updateBonusHint() {
        const isSeparate = document.querySelector('input[name="bonusTaxType"]:checked').value === 'separate';
        if (isSeparate) {
            bonusMonthHint.textContent = "年终奖将并入发放当月的税后收入（单独计税）";
        } else {
            bonusMonthHint.textContent = "年终奖将并入发放当月综合所得，进行累积计税";
        }
    }

    // 监听专项附加扣除复选框变化
    deductionCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const type = e.target.dataset.type;
            const checked = e.target.checked;

            if (checked) {
                // 互斥逻辑：住房租金 vs 住房贷款利息
                if (type.startsWith('loan')) {
                    uncheck('rent'); // 取消住房租金
                    // Also uncheck other loan option
                    if (type === 'loan_100') uncheck('loan_50');
                    if (type === 'loan_50') uncheck('loan_100');
                }
                
                if (type === 'rent') {
                    uncheckGroup(['loan_100', 'loan_50']); // 取消所有贷款利息选项
                }
                
                // 互斥逻辑：赡养老人
                if (type === 'elder') uncheck('elder_share');
                if (type === 'elder_share') uncheck('elder');

                // 互斥逻辑：子女教育
                if (type === 'children_100') uncheck('children_50');
                if (type === 'children_50') uncheck('children_100');

                // 互斥逻辑：婴幼儿照护
                if (type === 'baby_100') uncheck('baby_50');
                if (type === 'baby_50') uncheck('baby_100');
            }
            
            updateSpecialDeduction();
        });
    });

    function uncheck(type) {
        const el = document.querySelector(`input[data-type="${type}"]`);
        if(el) el.checked = false;
    }

    function uncheckGroup(types) {
        types.forEach(type => uncheck(type));
    }

    // 监听专项附加扣除输入框手动输入，如果手动输入与选中总和不符，则取消所有选中
    if(specialDeductionInput) {
        specialDeductionInput.addEventListener('input', () => {
            const currentTotal = calculateCheckboxTotal();
            const inputValue = parseFloat(specialDeductionInput.value) || 0;
            
            if (currentTotal !== inputValue) {
                deductionCheckboxes.forEach(cb => cb.checked = false);
            }
        });
    }

    function calculateCheckboxTotal() {
        let total = 0;
        deductionCheckboxes.forEach(cb => {
            if (cb.checked) {
                total += parseFloat(cb.value) || 0;
            }
        });
        return total;
    }

    function updateSpecialDeduction() {
        const total = calculateCheckboxTotal();
        specialDeductionInput.value = total > 0 ? total : '';
        if(total === 0) specialDeductionInput.value = 0;
    }

    // 校验基数输入：低于下限重置为下限，高于上限重置为上限
    function validateBaseInput(inputElement, min, max) {
        let value = parseFloat(inputElement.value);
        if (isNaN(value)) return;

        if (value < min) {
            inputElement.value = min;
        } else if (value > max) {
            inputElement.value = max;
        }
    }

    // 更新基数输入框值 - 修复bug：当税前月薪小于下限或高于上限时，基数设为下限或上限
    function updateBaseInputs() {
        const monthlySalary = parseFloat(monthlySalaryInput.value) || 0;
        
        // 社保基数：当税前月薪小于下限或高于上限时，设为下限或上限；否则设为税前月薪
        let socialBase = monthlySalary;
        if (socialBase < SOCIAL_PARAMS.baseMin) {
            socialBase = SOCIAL_PARAMS.baseMin;
        } else if (socialBase > SOCIAL_PARAMS.baseMax) {
            socialBase = SOCIAL_PARAMS.baseMax;
        }
        socialBaseInput.value = socialBase;
        
        // 公积金基数：当税前月薪小于下限或高于上限时，设为下限或上限；否则设为税前月薪
        let fundBase = monthlySalary;
        if (fundBase < FUND_PARAMS.baseMin) {
            fundBase = FUND_PARAMS.baseMin;
        } else if (fundBase > FUND_PARAMS.baseMax) {
            fundBase = FUND_PARAMS.baseMax;
        }
        fundBaseInput.value = fundBase;
    }

    // 表单提交事件
    if(salaryForm) {
        salaryForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // 提交前再次校验基数范围（防止用户输入后直接回车没触发blur）
            validateBaseInput(socialBaseInput, SOCIAL_PARAMS.baseMin, SOCIAL_PARAMS.baseMax);
            validateBaseInput(fundBaseInput, FUND_PARAMS.baseMin, FUND_PARAMS.baseMax);

            // 获取输入值
            const monthlySalary = parseFloat(monthlySalaryInput.value) || 0;
            const specialDeduction = parseFloat(specialDeductionInput.value) || 0;
            // 优先使用用户输入的基数，无输入则用基于税前月薪的默认值
            let socialBase = parseFloat(socialBaseInput.value);
            if (isNaN(socialBase)) socialBase = monthlySalary;
            
            let fundBase = parseFloat(fundBaseInput.value);
            if (isNaN(fundBase)) fundBase = monthlySalary;
            
            const fundRatioVal = parseFloat(fundRatio.value) / 100 || 0.07;
            const companyFundRatioVal = parseFloat(companyFundRatio.value) / 100 || 0.07;
            const yearBonus = parseFloat(yearBonusInput.value) || 0;
            const bonusMonth = parseInt(bonusMonthSelect.value) || 12;
            const bonusTaxType = document.querySelector('input[name="bonusTaxType"]:checked').value;

            // 计算社保
            const socialResult = calculateSocialSecurity(socialBase);
            // 计算公积金 (个人)
            const fundResult = calculateFund(fundBase, fundRatioVal);
            // 计算公积金 (公司)
            const companyFundResult = calculateFund(fundBase, companyFundRatioVal);
            
            // 计算年终奖个税
            // 如果选择并入综合所得(combine)，则年终奖单独计税部分为0，年终奖金额将累加到当月收入中进行统一计税
            let bonusTaxResult = { tax: 0, afterTax: yearBonus }; // 默认不计税（为了后面统一逻辑），或者单独计税结果
            
            if (bonusTaxType === 'separate') {
                bonusTaxResult = calculateBonusTax(yearBonus);
            }
            
            // 计算1-12月全量个税数据（含年终奖并入）
            const allMonthsTaxResult = calculateAllMonthsTax(
                monthlySalary, 
                socialResult.total, 
                fundResult, 
                specialDeduction, 
                yearBonus, 
                bonusTaxResult.afterTax, // 这里的afterTax仅用于separate模式下的显示，combine模式下需要特殊处理
                bonusMonth,
                bonusTaxType,
                companyFundResult // 传入公司公积金，用于计算综合实际收入
            );
            
            // 如果是combine模式，年终奖已经在calculateAllMonthsTax中被扣税了，
            // 但为了年度汇总显示正确，我们需要把bonusTaxResult的tax设为0（因为包含在annualSalaryTax里了），
            // 或者我们需要调整年度汇总的逻辑。
            // 简单起见：
            // separate模式：annualSalaryTax是工资税，annualBonusTax是年终奖税。
            // combine模式：annualSalaryTax包含了年终奖产生的税（因为它并入工资了），annualBonusTax应为0。
            
            // 计算年度汇总
            const annualResult = calculateAnnualSummary(
                monthlySalary, 
                socialResult.total, 
                fundResult, 
                specialDeduction,
                allMonthsTaxResult, 
                yearBonus, 
                bonusTaxType === 'separate' ? bonusTaxResult.tax : 0,
                companyFundResult
            );

            // 更新结果显示
            updateResultDisplay(
                monthlySalary, 
                socialResult, 
                fundResult, 
                specialDeduction,
                allMonthsTaxResult, 
                yearBonus, 
                bonusTaxResult, 
                annualResult,
                bonusMonth,
                bonusTaxType,
                companyFundResult
            );

            // 显示结果区域
            initialPrompt.classList.add('hidden');
            resultContainer.classList.remove('opacity-0');
            resultContainer.classList.remove('hidden');
            
            // 滚动到结果区域
            setTimeout(() => {
                resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        });
    }

    /**
     * 调整基数到合法范围（下限≤基数≤上限）
     * @param {number} base 原始基数
     * @param {number} min 下限
     * @param {number} max 上限
     * @returns {number} 调整后的合法基数
     */
    function getAdjustedBase(base, min, max) {
        return Math.max(min, Math.min(max, base));
    }

    /**
     * 计算社保个人缴纳
     * @param {number} socialBase 社保基数
     * @returns {object} 社保计算结果
     */
    function calculateSocialSecurity(socialBase) {
        // 确保基数在上下限范围内
        const base = getAdjustedBase(socialBase, SOCIAL_PARAMS.baseMin, SOCIAL_PARAMS.baseMax);
        
        // 各项社保计算
        const pension = base * SOCIAL_PARAMS.pensionRatio;
        const medical = base * SOCIAL_PARAMS.medicalRatio + SOCIAL_PARAMS.medicalFixed;
        const unemployment = base * SOCIAL_PARAMS.unemploymentRatio;
        const total = pension + medical + unemployment;

        return {
            base: base,
            pension: parseFloat(pension.toFixed(2)),
            medical: parseFloat(medical.toFixed(2)),
            unemployment: parseFloat(unemployment.toFixed(2)),
            total: parseFloat(total.toFixed(2))
        };
    }

    /**
     * 计算公积金个人缴纳
     * @param {number} fundBase 公积金基数
     * @param {number} ratio 缴纳比例
     * @returns {number} 公积金缴纳金额
     */
    function calculateFund(fundBase, ratio) {
        // 确保基数在上下限范围内
        const base = getAdjustedBase(fundBase, FUND_PARAMS.baseMin, FUND_PARAMS.baseMax);
        const fund = base * ratio;
        return parseFloat(fund.toFixed(2));
    }

    /**
     * 计算1-12月全量累计个税数据（含年终奖并入发放当月）
     * @param {number} monthlySalary 税前月薪
     * @param {number} socialTotal 社保总额
     * @param {number} fund 公积金
     * @param {number} specialDeduction 每月专项附加扣除
     * @param {number} yearBonus 年终奖总额
     * @param {number} bonusAfterTax 年终奖税后金额（仅单独计税模式下有效）
     * @param {number} bonusMonth 年终奖发放月份
     * @param {string} bonusTaxType 计税方式 'separate' | 'combine'
     * @param {number} companyFund 公司缴纳公积金
     * @returns {array} 1-12月个税计算结果数组
     */
    function calculateAllMonthsTax(monthlySalary, socialTotal, fund, specialDeduction, yearBonus, bonusAfterTax, bonusMonth, bonusTaxType, companyFund) {
        const monthsResult = [];
        const monthlyDeduction = 5000; // 个税起征点
        const monthlySocialFund = socialTotal + fund; // 每月社保公积金
        
        // 循环计算1-12月
        for (let month = 1; month <= 12; month++) {
            // 累计计算
            let accumIncome = monthlySalary * month; // 累计收入
            
            // 如果是合并计税，且当前月份>=发放月份，累计收入要加上年终奖
            if (bonusTaxType === 'combine' && month >= bonusMonth) {
                accumIncome += yearBonus;
            }

            const accumSocialFund = monthlySocialFund * month; // 累计社保公积金
            const accumBasicDeduction = monthlyDeduction * month; // 累计基本减除费用
            const accumSpecialDeduction = specialDeduction * month; // 累计专项附加扣除
            
            // 累计应纳税所得额
            const accumTaxableIncome = Math.max(0, accumIncome - accumSocialFund - accumBasicDeduction - accumSpecialDeduction);
            
            // 计算累计应缴个税
            const accumTax = calculateAnnualTax(accumTaxableIncome);

            // 适用税率（按综合所得年度税率表，基于累计应纳税所得额）
            let taxRatePct = 0;
            let taxQuickDeduction = 0;
            for (let i = ANNUAL_TAX_RATE_TABLE.length - 1; i >= 0; i--) {
                const level = ANNUAL_TAX_RATE_TABLE[i];
                if (accumTaxableIncome > level.threshold) {
                    taxRatePct = Math.round(level.rate * 100);
                    taxQuickDeduction = level.deduction;
                    break;
                }
            }
            
            // 计算上月累计个税（用于当月个税计算）
            let prevAccumTax = 0;
            if (month > 1) {
                // 上月累计收入计算（也要考虑年终奖是否在上月之前发放）
                let prevAccumIncome = monthlySalary * (month - 1);
                if (bonusTaxType === 'combine' && (month - 1) >= bonusMonth) {
                    prevAccumIncome += yearBonus;
                }

                const prevAccumTaxableIncome = Math.max(0, 
                    prevAccumIncome - monthlySocialFund * (month - 1) - monthlyDeduction * (month - 1) - specialDeduction * (month - 1)
                );
                prevAccumTax = calculateAnnualTax(prevAccumTaxableIncome);
            }
            
            // 当月个税
            const currentMonthTax = parseFloat((accumTax - prevAccumTax).toFixed(2));
            
            // 当月税后收入
            // 基础税后 = 当月工资 - 社保公积金 - 当月个税
            let currentIncome = monthlySalary;
            
            // 如果当月发放年终奖，当月收入要加上年终奖
            if (month === bonusMonth) {
                currentIncome += yearBonus;
            }
            
            let afterTax = parseFloat((currentIncome - monthlySocialFund - currentMonthTax).toFixed(2));
            
            // 如果是单独计税，且当月发放，此时的currentMonthTax只扣了工资的税
            // 年终奖的税还没扣（或者说是单独算的），所以要单独加上年终奖税后值？
            // 不对，如果是单独计税，currentMonthTax纯粹是工资产生的税。
            // 此时 afterTax = (工资 + 年终奖) - 社保 - 工资个税。但这不对，年终奖还没扣税。
            // 所以 separate 模式下：
            // afterTax = (工资 - 社保 - 工资个税) + (年终奖 - 年终奖个税)
            // 即: afterTax = (monthlySalary - monthlySocialFund - currentMonthTax) + bonusAfterTax
            
            if (bonusTaxType === 'separate' && month === bonusMonth) {
                // 重新计算：只计算工资部分的税后 + 年终奖税后
                afterTax = parseFloat((monthlySalary - monthlySocialFund - currentMonthTax + bonusAfterTax).toFixed(2));
            }

            // 计算综合实际收入 = 税后收入 + 个人公积金 + 公司公积金
            // 个人公积金已经在afterTax中被扣除了，这里要加回来算“实际到手价值”吗？
            // 通常理解的“实际收入”包含：到手现金 + 公积金账户增加额（个人+公司）
            // afterTax 是到手现金
            // 公积金账户增加 = fund + companyFund
            const totalIncome = parseFloat((afterTax + fund + companyFund).toFixed(2));

            monthsResult.push({
                month: month,
                monthlyDeduction: monthlyDeduction,
                accumBasicDeduction: accumBasicDeduction,
                accumSpecialDeduction: accumSpecialDeduction,
                accumIncome: accumIncome,
                accumSocialFund: accumSocialFund,
                accumTaxableIncome: parseFloat(accumTaxableIncome.toFixed(2)),
                accumTax: parseFloat(accumTax.toFixed(2)),
                prevAccumTax: parseFloat(prevAccumTax.toFixed(2)),
                currentMonthTax: currentMonthTax,
                afterTax: parseFloat(afterTax.toFixed(2)),
                totalIncome: totalIncome,
                hasBonus: month === bonusMonth,
                bonusAfterTax: (month === bonusMonth && bonusTaxType === 'separate') ? bonusAfterTax : 0, // 仅用于展示
                taxRatePct: taxRatePct,
                taxQuickDeduction: taxQuickDeduction
            });
        }

        return monthsResult;
    }

    /**
     * 根据年度应纳税所得额计算个税
     * @param {number} taxableIncome 年度应纳税所得额
     * @returns {number} 个税金额
     */
    function calculateAnnualTax(taxableIncome) {
        let tax = 0;
        let remaining = taxableIncome;

        // 逐级计算个税（年度税率表）
        for (let i = ANNUAL_TAX_RATE_TABLE.length - 1; i >= 0; i--) {
            const level = ANNUAL_TAX_RATE_TABLE[i];
            if (remaining > level.threshold) {
                tax += (remaining - level.threshold) * level.rate;
                remaining = level.threshold;
            }
        }

        return parseFloat(tax.toFixed(2));
    }

    /**
     * 计算年终奖个税（单独计税）
     * @param {number} bonus 年终奖金额
     * @returns {object} 年终奖个税计算结果
     */
    function calculateBonusTax(bonus) {
        if (bonus <= 0) {
            return { tax: 0, afterTax: 0, ratePct: 0, quickDeduction: 0 };
        }

        // 年终奖除以12找税率（月度税率表逻辑）
        const bonusPerMonth = bonus / 12;
        let rate = 0;
        let deduction = 0;

        // 匹配税率
        for (let i = MONTHLY_TAX_TABLE.length - 1; i >= 0; i--) {
            const level = MONTHLY_TAX_TABLE[i];
            if (bonusPerMonth > level.threshold) {
                rate = level.rate;
                deduction = level.deduction;
                break;
            }
        }

        // 计算个税
        const tax = parseFloat((bonus * rate - deduction).toFixed(2));
        const afterTax = parseFloat((bonus - tax).toFixed(2));

        return {
            tax: tax,
            afterTax: afterTax,
            ratePct: Math.round(rate * 100),
            quickDeduction: deduction
        };
    }

    /**
     * 计算年度汇总
     * @returns {object} 年度汇总结果
     */
    function calculateAnnualSummary(monthlySalary, socialTotal, fund, specialDeduction, allMonthsTaxResult, yearBonus, bonusTax, companyFund) {
        // 计算年度工资个税总和（12个月累计）
        const annualSalaryTax = allMonthsTaxResult[11].accumTax; // 12月累计个税即为全年工资个税
        // 年度税前收入
        const annualPreTax = parseFloat((monthlySalary * 12 + yearBonus).toFixed(2));

        // 年度个人社保、公积金
        const annualSocialPersonal = parseFloat((socialTotal * 12).toFixed(2));
        const annualFundPersonal = parseFloat((fund * 12).toFixed(2));

        // 年度专项附加扣除
        const annualSpecialDeduction = parseFloat((specialDeduction * 12).toFixed(2));
        // 年度总个税
        const annualTotalTax = parseFloat((annualSalaryTax + bonusTax).toFixed(2));
        // 年度税后收入 = 税前 - 个人社保 - 个人公积金 - 个税
        const annualAfterTax = parseFloat((annualPreTax - annualSocialPersonal - annualFundPersonal - annualTotalTax).toFixed(2));
        
        // 年度公司缴纳公积金
        const annualCompanyFund = parseFloat((companyFund * 12).toFixed(2));
        
        // 年度含公积金税后收入 = 年度税后收入 + 年度个人公积金 + 年度公司公积金
        const annualTotalIncome = parseFloat((annualAfterTax + annualFundPersonal + annualCompanyFund).toFixed(2));
        const annualSocialTaxTotal = parseFloat((annualSocialPersonal + annualFundPersonal + annualTotalTax).toFixed(2));

        // 年度适用税率（按12月累计应纳税所得额对应税率表）
        const lastMonth = allMonthsTaxResult[11] || allMonthsTaxResult[allMonthsTaxResult.length - 1];
        const annualTaxableIncome = lastMonth ? (lastMonth.accumTaxableIncome || 0) : 0;
        let annualTaxRatePct = 0;
        let annualTaxQuickDeduction = 0;
        for (let i = ANNUAL_TAX_RATE_TABLE.length - 1; i >= 0; i--) {
            const level = ANNUAL_TAX_RATE_TABLE[i];
            if (annualTaxableIncome > level.threshold) {
                annualTaxRatePct = Math.round(level.rate * 100);
                annualTaxQuickDeduction = level.deduction;
                break;
            }
        }

        return {
            annualPreTax,
            annualSocialPersonal,
            annualFundPersonal,
            annualSpecialDeduction,
            annualSalaryTax: parseFloat(annualSalaryTax.toFixed(2)),
            annualBonusTax: bonusTax,
            annualTotalTax,
            annualAfterTax,
            annualTotalIncome,
            annualCompanyFund,
            annualSocialTaxTotal,
            annualTaxRatePct,
            annualTaxQuickDeduction,
            annualTaxableIncome
        };
    }

    /**
     * 更新结果显示
     */
    function updateResultDisplay(
        monthlySalary, 
        socialResult, 
        fundResult, 
        specialDeduction,
        allMonthsTaxResult, 
        yearBonus, 
        bonusTaxResult, 
        annualResult,
        bonusMonth,
        bonusTaxType,
        companyFundResult
    ) {
        // 格式化金额显示（带货币符号）
        const formatMoney = (num) => `¥ ${num.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
        // 格式化数字显示（不带货币符号，用于表格）
        const formatNumber = (num) => num.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
        const formatShortNumber = (num) => {
            if (num === undefined || num === null || isNaN(num)) return '';
            return Number(num).toFixed(2).replace(/\.?0+$/, '');
        };
        const formatPercent = (ratio) => {
            if (ratio === undefined || ratio === null || isNaN(ratio)) return '--';
            const val = ratio * 100;
            return `${val.toFixed(2).replace(/\.?0+$/, '')}%`;
        };
        const pensionLabel = `养老保险 (${formatPercent(SOCIAL_PARAMS.pensionRatio)})`;
        const medicalLabel = `医疗保险 (${formatPercent(SOCIAL_PARAMS.medicalRatio)}${SOCIAL_PARAMS.medicalFixed > 0 ? `+${formatShortNumber(SOCIAL_PARAMS.medicalFixed)}元` : ''})`;
        const unemploymentLabel = `失业保险 (${formatPercent(SOCIAL_PARAMS.unemploymentRatio)})`;

        // 更新年终奖发放月份显示
        if(bonusMonthText) bonusMonthText.textContent = bonusMonth;

        // 清空原有表格数据
        if(monthsTableBody) monthsTableBody.innerHTML = '';
        if(annualDetail) annualDetail.innerHTML = '';

        // 生成“每月到手工资”表格（主行 + 可展开详情行）
        allMonthsTaxResult.forEach(monthData => {
            const gross = monthlySalary + (monthData.hasBonus ? yearBonus : 0);
            const tr = document.createElement('tr');
            tr.className = 'month-row';
            tr.dataset.month = String(monthData.month);
            tr.innerHTML = `
                <td>
                    <div class="month-cell">
                        <span class="month-text">${monthData.month}月</span>
                        <span class="month-toggle" data-action="toggle">点击展开详情</span>
                    </div>
                </td>
                <td>${formatNumber(gross)}</td>
                <td>
                    <div>${formatNumber(monthData.afterTax)}</div>
                    ${monthData.hasBonus ? '<span class="bonus-hint">(含年终奖)</span>' : ''}
                </td>
                <td>
                    <div>${formatNumber(monthData.totalIncome)}</div>
                    ${monthData.hasBonus ? '<span class="bonus-hint">(含年终奖)</span>' : ''}
                </td>
            `;
            monthsTableBody.appendChild(tr);

            const detailTr = document.createElement('tr');
            detailTr.className = 'month-detail-row hidden';
            detailTr.dataset.month = String(monthData.month);
            detailTr.innerHTML = `
                <td colspan="4">
                    <div class="wx-detail">
                        <div class="wx-detail-section">
                            <div class="wx-detail-title">五险一金个人缴纳明细</div>
                            <div class="wx-detail-line"><span class="wx-detail-k">医疗保险：</span><span class="wx-detail-v">${formatNumber(socialResult.medical)}</span></div>
                            <div class="wx-detail-line"><span class="wx-detail-k">养老保险：</span><span class="wx-detail-v">${formatNumber(socialResult.pension)}</span></div>
                            <div class="wx-detail-line"><span class="wx-detail-k">失业保险：</span><span class="wx-detail-v">${formatNumber(socialResult.unemployment)}</span></div>
                            <div class="wx-detail-line"><span class="wx-detail-k">公积金(个人)：</span><span class="wx-detail-v">${formatNumber(fundResult)}</span></div>
                            <div class="wx-detail-line wx-detail-strong"><span class="wx-detail-k">合计：</span><span class="wx-detail-v">${formatNumber(socialResult.total + fundResult)}</span></div>
                        </div>

                        <div class="wx-detail-section">
                            <div class="wx-detail-title">个税缴纳明细</div>
                            <div class="wx-detail-line"><span class="wx-detail-k">工资个税：</span><span class="wx-detail-v">${formatNumber(monthData.currentMonthTax)}</span></div>
                            <div class="wx-detail-line"><span class="wx-detail-k">工资适用税率：</span><span class="wx-detail-v">${monthData.taxRatePct}%（速算扣除数 ${monthData.taxQuickDeduction}）</span></div>
                            ${monthData.hasBonus && bonusTaxType === 'separate' && bonusTaxResult.tax > 0 ? `
                                <div class="wx-detail-line"><span class="wx-detail-k">奖金个税：</span><span class="wx-detail-v">${formatNumber(bonusTaxResult.tax)}</span></div>
                                <div class="wx-detail-line"><span class="wx-detail-k">奖金适用税率：</span><span class="wx-detail-v">${bonusTaxResult.ratePct}%（速算扣除数 ${bonusTaxResult.quickDeduction}）</span></div>
                            ` : ''}
                            <div class="wx-detail-line wx-detail-strong"><span class="wx-detail-k">本月个税合计：</span><span class="wx-detail-v">${formatNumber(monthData.hasBonus && bonusTaxType === 'separate' ? (monthData.currentMonthTax + bonusTaxResult.tax) : monthData.currentMonthTax)}</span></div>
                            ${monthData.hasBonus && bonusTaxType === 'combine' ? `<div class="wx-detail-note">注：年终奖并入综合所得时，奖金相关税额已合并计入本月个税，无法拆分展示。</div>` : ''}
                        </div>

                        <div class="wx-detail-section">
                            <div class="wx-detail-title">税后到手工资</div>
                            <div class="wx-detail-formula">税后到手 = 税前收入(${formatNumber(gross)}) - 五险一金个人合计(${formatNumber(socialResult.total + fundResult)}) - 个税(${formatNumber(monthData.hasBonus && bonusTaxType === 'separate' ? (monthData.currentMonthTax + bonusTaxResult.tax) : monthData.currentMonthTax)}) = ${formatNumber(monthData.afterTax)}</div>
                        </div>

                        <div class="wx-detail-section">
                            <div class="wx-detail-title">含公积金到手工资</div>
                            <div class="wx-detail-formula">含公积金到手 = 税后到手(${formatNumber(monthData.afterTax)}) + 个人公积金(${formatNumber(fundResult)}) + 公司公积金(${formatNumber(companyFundResult)}) = ${formatNumber(monthData.totalIncome)}</div>
                        </div>
                    </div>
                </td>
            `;
            monthsTableBody.appendChild(detailTr);
        });

        // 绑定展开/收起（事件委托）
        monthsTableBody.onclick = (evt) => {
            const target = evt.target;
            if (!target || !target.dataset || target.dataset.action !== 'toggle') return;
            const row = target.closest('tr');
            if (!row) return;
            const m = row.dataset.month;
            const detailRow = monthsTableBody.querySelector(`tr.month-detail-row[data-month="${m}"]`);
            if (!detailRow) return;
            const isOpen = !detailRow.classList.contains('hidden');
            detailRow.classList.toggle('hidden', isOpen);
            target.textContent = isOpen ? '点击展开详情' : '点击收起详情';
        };

        // 更新年度汇总
        const annualPreTaxEl = document.getElementById('annualPreTax');
        const annualSocialTaxEl = document.getElementById('annualSocialTaxTotal');
        const annualAfterTaxEl = document.getElementById('annualAfterTax');
        const annualIncomeEl = document.getElementById('annualTotalIncome');

        if (annualPreTaxEl) annualPreTaxEl.textContent = formatNumber(annualResult.annualPreTax);
        if (annualSocialTaxEl) annualSocialTaxEl.textContent = formatNumber(annualResult.annualSocialTaxTotal);
        if (annualAfterTaxEl) annualAfterTaxEl.textContent = formatNumber(annualResult.annualAfterTax);
        if (annualIncomeEl) annualIncomeEl.textContent = formatNumber(annualResult.annualTotalIncome);

        // 年度详情（默认展开）
        if (annualDetail) {
            annualDetail.innerHTML = `
                <div class="wx-detail-section">
                    <div class="wx-detail-title">全年五险一金个人缴纳明细</div>
                    <div class="wx-detail-line"><span class="wx-detail-k">社保(个人)：</span><span class="wx-detail-v">${formatNumber(annualResult.annualSocialPersonal)}</span></div>
                    <div class="wx-detail-line"><span class="wx-detail-k">公积金(个人)：</span><span class="wx-detail-v">${formatNumber(annualResult.annualFundPersonal)}</span></div>
                    <div class="wx-detail-line wx-detail-strong"><span class="wx-detail-k">合计：</span><span class="wx-detail-v">${formatNumber(annualResult.annualSocialPersonal + annualResult.annualFundPersonal)}</span></div>
                </div>

                <div class="wx-detail-section">
                    <div class="wx-detail-title">全年个税缴纳明细</div>
                    <div class="wx-detail-line"><span class="wx-detail-k">工资个税：</span><span class="wx-detail-v">${formatNumber(annualResult.annualSalaryTax)}</span></div>
                    <div class="wx-detail-line"><span class="wx-detail-k">工资适用税率：</span><span class="wx-detail-v">${annualResult.annualTaxRatePct}%（速算扣除数 ${annualResult.annualTaxQuickDeduction}）</span></div>
                    ${annualResult.annualBonusTax > 0 ? `
                        <div class="wx-detail-line"><span class="wx-detail-k">奖金个税：</span><span class="wx-detail-v">${formatNumber(annualResult.annualBonusTax)}</span></div>
                        <div class="wx-detail-line"><span class="wx-detail-k">奖金适用税率：</span><span class="wx-detail-v">${bonusTaxResult.ratePct}%（速算扣除数 ${bonusTaxResult.quickDeduction}）</span></div>
                    ` : ''}
                    <div class="wx-detail-line wx-detail-strong"><span class="wx-detail-k">全年个税合计：</span><span class="wx-detail-v">${formatNumber(annualResult.annualTotalTax)}</span></div>
                    ${bonusTaxType === 'combine' ? `<div class="wx-detail-note">注：年终奖并入综合所得时，奖金相关税额已合并计入工资个税，无法拆分展示。</div>` : ''}
                </div>

                <div class="wx-detail-section">
                    <div class="wx-detail-title">全年税后到手工资</div>
                    <div class="wx-detail-formula">全年税后到手 = 税前收入(${formatNumber(annualResult.annualPreTax)}) - 五险一金个人合计(${formatNumber(annualResult.annualSocialPersonal + annualResult.annualFundPersonal)}) - 个税(${formatNumber(annualResult.annualTotalTax)}) = ${formatNumber(annualResult.annualAfterTax)}</div>
                </div>

                <div class="wx-detail-section">
                    <div class="wx-detail-title">全年含公积金到手工资</div>
                    <div class="wx-detail-formula">全年含公积金到手 = 全年税后到手(${formatNumber(annualResult.annualAfterTax)}) + 个人公积金(${formatNumber(annualResult.annualFundPersonal)}) + 公司公积金(${formatNumber(annualResult.annualCompanyFund)}) = ${formatNumber(annualResult.annualTotalIncome)}</div>
                </div>
            `;
        }
    }
});
