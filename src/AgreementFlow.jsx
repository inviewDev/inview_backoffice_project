import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Spinner } from 'react-bootstrap';
import './styles/agreement_flow.css';

const termsSections = [
  {
    title: '제 1 조 【목적】',
    body: [
      '본 계약은 "{{companyName}}"(이하 “갑”)이 ”(주)아이앤뷰커뮤니케이션“(이하 “을”)에게 온·오프라인 마케팅 대행서비스(이하 "마케팅 대행 서비스")를 위탁함에 있어서 계약 당사자 간의 권리 의무 및 책임사항 등을 규정함을 목적으로 한다.',
    ],
  },
  {
    title: '제 2 조 【정의】',
    body: [
      '1. "마케팅 대행 서비스"라 함은 검색광고, 홈페이지 등의 제작, 블로그, SNS등의 컨텐츠 포스팅 등을 통한 마케팅 서비스를 총칭하며, 이를 위한 작업 착수부터 완료시점까지의 제반 업무를 포함한다.',
      '2. "홈페이지"라 함은 “을”이 마케팅 대행 서비스를 위하여 제작 및 제공하는 PC웹, 모바일웹, 반응형웹, 쇼핑몰 등 일체의 웹사이트를 의미한다.',
      '3. "착수 단계"라 함은 홈페이지 제작과 관련하여 본 계약 성립 후 3시간을 경과한 시점부터 “개발 단계” 해당 이전까지를 의미한다.',
      '4. "개발 단계"라 함은 “갑”이 “을”과 협의하여 홈페이지 시안을 선택한 시점 또는 “갑”이 “을”에 의한 임의 선택을 희망하는 의사를 표시한 시점부터 “완료 단계” 해당 이전까지를 의미한다.',
      '5. "완료 단계"라 함은 “을”이 홈페이지 제작을 완료한 후 “갑”에게 전화, 이메일, 문자메시지 등을 통하여 완료 사실을 통보한 시점 이후를 의미한다.',
      '6. "검색광고"라 함은 특정 키워드와 웹사이트를 연계하여 "광고매체 이용자"에게 해당 웹사이트에 관한 정보를 보여주는 방식의 온라인 광고를 말한다.',
      '7. "광고매체"라 함은 "을"에 의해 "검색광고"가 게재되는 매체를 말한다.',
      '8. "블로그, SNS 포스팅"이라 함은 특정 "블로그, SNS 이용자"에게 해당 내용에 관한 정보를 보여주는 방식의 온라인 마케팅을 말한다.',
      '9. "블로그, SNS"라 함은 "을"에 의해 "포스팅"이 게재되는 각종 포털사이트 또는 블로그 사이트의 블로그 및 페이스북, 인스타그램 등의 SNS(Social Network Service) 매체들을 말한다.',
      '10. "컨텐츠"라 함은 홈페이지 제작, 디자인, 포스팅, 어플리케이션, 업체등록 등 "갑"의 의뢰에 따라 고유한 특성에 맞춰 제작ㆍ진행된 모든 결과물을 말한다.',
      '11. "서비스 개시"라 함은 “을”이 마케팅 대행서비스 중 광고계정 생성부터 등록, 디자인작업, 포스팅 작성 등 최초로 서비스에 착수하는 시점을 의미한다.',
      '12. "자동결제"라 함은 당사자의 별도의 의사표시가 없는 한 매월 일정한 대금이 자동으로 결제되는 방식으로, CMS, 휴대폰결제, 카드자동결제 등 별도의 청약서가 포함된 서비스를 말한다.',
    ],
  },
  {
    title: '제 3 조 【계약의 성립】',
    body: [
      '1. 본 계약은 "갑"이 "을"에게 "마케팅 대행 서비스"를 위탁할 의사를 표시하고, "을"이 이를 승낙함으로써 성립한다.',
      '2. "을"은 "갑"에게 사업자등록증, 통신판매신고증 등 관련법상의 등록증, 허가증, 이미지, 기타 필요한 자료 및 협조사항을 요청할 수 있으며, "갑"은 "을"의 요청에 성실히 응하여야 한다.',
      '3. "을"은 "갑"의 사업상의 정보 또는 개인정보 등을 "마케팅 대행 서비스"에 활용할 수 있으며, 그 이외의 목적으로는 사용할 수 없다.',
      '4. "을"은 "마케팅 대행 서비스"의 일환으로서 온라인 검색광고, 마케팅 서비스, 컨텐츠 제작 등 해당 서비스를 성실히 수행하도록 노력하여야 하며, 이와 관련한 정책은 매체사의 정책(약관)을 최우선으로 함을 원칙으로 한다.',
      '5. 계약 성립 시점과 서비스기간은 별도로 적용하며, 서비스등록확인서 내용에 명시된 서비스기간은 별도의 명시된 바가 없는 경우 "서비스개시일" 시점부터 적용한다. 서비스개시일은 계약 당일을 포함할 수 있으며, "을"의 일정에 따라 "을"이 정한 시점에 따른다. 단, "갑"의 별도의 요청이 있을 경우 "을"과 협의 후 서비스 개시일을 정한다.',
    ],
  },
  {
    title: '제 4 조 【서비스의 제공 및 변경】',
    body: [
      '1. "갑"이 "마케팅 대행 서비스"의 내용을 변경하고자 할 때에는 이를 "을"에게 통지하여야 한다.',
      '2. "을"은 서비스 개시일에 맞추어 마케팅 대행 서비스가 진행 될 수 있도록 노력하여야 하며, 여러 가지 사유로 개시가 지연될 경우 즉시 이를 "갑"에게 통지하여야 한다.',
      '3. "갑"과 "을" 사이에 무상으로 지원되는 서비스는 본 계약이 계약기간 만료로 종료되는 것을 전제로 지원되는 것으로, 계약기간 종료 이전에 "갑"의 귀책사유로 인하여 계약이 종료된 때에는 적용되지 않는다.',
      '4. "을"의 구체적인 "마케팅 대행 서비스" 방법 및 내용은 현행법령 및 각 매체사의 정책(약관)에 따라 이루어지며, 중간에 그에 따른 변동사항이 발생할 수 있다.',
      '5. "을"의 서비스 제공 중 일부 집행에 천재지변, 노출 방해, 중복 과금, 악성코드, 비정상적인 과금 등으로 불가항력에 의한 변동사항 등 이 있을 경우 일시적 중단 또는 지연 될 수 있다. 단, 위의 사유로 중단 또는 지연 되는 경우 “을”은 확인 즉시 조치를 취하여야 하며, 조치 불가 또는 변경사항이 있을 경우 “갑”에게 통지하여야 한다.',
      '6. 컨텐츠 제작물 또는 결과물은 "을"이 제공하는 틀 내에서 진행되며, "갑"에게 전달 완료 48시간 경과 시에는 아래의 사항과 같은 사항 이외의 수정, 변경 요청은 불가능하거나, 비용이 발생할 수 있다.',
      '* 로고, 상호 변경 - "갑"이 보유한 로고, 또는 Text형 로고',
      '* 대분류, 소분류(카테고리)명 - 분류 추가를 제외한 삭제 혹은 Text 변경 (단, 업종별 전용홈페이지는 카테고리 변경 불가)',
      '* 하단의 업체정보 - 상호, 사업자정보, 주소, 연락처 등',
      '7. 제6항에도 불구하고, 도메인(domain)은 전산 등록 완료 후에는 수정, 변경할 수 없다.',
      '8. SNS(페이스북, 인스타그램)및 기간보장형을 제외한 블로그포스팅은 별도의 기간이 존재하지 않는 상품으로 기간보장이 아닌 포스팅 횟수로 판매되며, 사용자 및 페이지의 품질 향상, 계정정지 우려 등의 사유로 게시일로 부터 20일 이후 비공개 또는 삭제 될 수 있다.',
      '9. 홈페이지, SNS포스팅 등 개발 또는 디자인 담당자와 유선상 컨펌 후 이메일로 시안 및 이미지 요청이 있을 경우 안내문에 명시된 기간 내로 미회신 시 "을"의 임의진행에 동의하는것으로 간주한다.',
      '(임의진행 비희망 또는 특수한 상황으로 명시된 기간내로 불가능한 경우 그 기간내에 희망일자를 협의하여야 한다.)',
      '10. 기간이 명시된 상품(이하 “기간제상품”)은 본 계약기간과 별도로 기간만료시 종료되며, “갑”은 “을” 또는 호스팅 및 도메인 회사에 기간연장을 하여야한다. <신설 2017.7.16.>',
      '11. 본조 제10항에 따라 기간제상품의 기간만료로 인한 서비스종료시 “갑”은 “을”에게 책임을 물을수 없다. (기간만료 이전 연장신청 권장) <신설 2017.7.16.>',
    ],
  },
  {
    title: '제 5 조 【계약의 해제·해지】',
    body: [
      '1. "갑"은 “을”이 본 계약에 따라 마케팅 대행 서비스에 필요한 업무에 착수하기 전 단계에서는 본 계약서를 수령한 후 14일 이내에 본 계약을 해제할 수 있다.',
      '2. “갑”은 “을”이 계약 이행을 위한 작업에 착수하거나, 서비스가 개시된 이후 "갑"이 부득이한 사정으로 본 계약의 해제 또는 해지를 원하는 경우, “갑”은 “을”이 동의한 경우에 한하여 본 계약을 종료할 수 있다.',
      '3. 자동결제 방식 서비스 계약의 경우, “갑”은 “을”에게 익월 이후 서비스를 이용하지 않을 것을 통지함으로써 계약을 해지할 수 있다. 단, 이 경우에도 당월 분의 계약은 존속한다.',
      '4. 계약의 해제·해지 시에는 해제·해지의 사유, 이에 관한 증빙자료, 신청인의 신분증(사업자등록증) 사본 1부를 "을"의 해당 담당자에게 FAX로 접수하여야 한다.',
    ],
  },
  {
    title: '제 6 조 【계약의 해제·해지에 따른 환불】',
    body: [
      '1. 전조 제1항에 따라 계약이 해제·해지된 경우, “을”은 “갑”으로부터 받은 결제대금의 20%를 공제한 금액을 환불한다.',
      '2. 전조 제2항에 따라 계약이 해제·해지된 경우, “을”은 “갑”으로부터 받은 결제대금의 20% 및 그 시점까지 “을”이 투입한 컨텐츠 제작 비용 등을 공제한 나머지 금액을 환불한다. 공제할 컨텐츠 제작 비용 등은 본조 3항 및 4항에 따라 산정한다.',
      '3. 도메인 및 홈페이지 제공 서비스에 관한 비용 공제는 다음 각호에 의한다.',
      '가. 도메인 대금은 전산 등록 완료 이후에는 전액 공제한다.',
      '나. 홈페이지 제공 서비스 대금은 착수단계 이전에 해제·해지한 경우에는 공제하지 않으나, 착수단계 이후에 해제·해지한 경우에는 그 시점에 따라 다음의 금액(VAT 포함)을 공제한다. 단, “갑”의 추가적인 요청에 따라 프로그램 개발, 디자인, 기타 특수한 서비스 제공에 관한 선택 항목이 계약에 포함된 경우에는 그 부분 해당 비용은 별도로 공제한다.',
      '① 착수 단계: 기본 세팅비용 99,000원',
      '② 개발 단계: 개발비용 승인금액의 20%',
      '③ 완료 단계: 개발비용 승인금액의 40%',
      '4. 블로그, SNS 포스팅 서비스에 관한 비용 공제는 다음 각호에 의한다.',
      '가. 패키지 상품의 경우, 홈페이지 제공 서비스 완료 단계 이전에는 공제하지 않으나, 서비스 완료 단계 이후에는 다음의 대금 전액을 공제한다.',
      '① SNS포스팅 : 330,000원 (1set 기준, 특수한 경우 계약서 내 별도 명시비용 적용)',
      '② 블로그 포스팅 : 110,000원 (1회 기준, 특수한 경우 계약서 내 별도 명시비용 적용)',
      '(블로그 1회 포스팅 해당, 월보장형은 별도 외주비용 적용)',
      '나. 패키지 내 포함 상품이 아닌 SNS마케팅 단품인 경우 결제금액에서 총 포스팅횟수를 나누어 1회당 금액을 산정 후 실제 진행된 포스팅횟수에 비례한 금액을 공제한다.',
      '공제금액 산정식 : (계약금액 / 총 포스팅 횟수) X 완료 포스팅 횟수',
      '다. 기간으로 서비스가 제공되는 월 보장형과 같은 상품은 해지요청 해당 월 포함 결제금액에서 계약 개월수로 나누어 1개월당 금액을 산정 후 경과 개월수에 해당하는 금액을 공제한다.',
      '공제금액 산정식 : (계약금액 / 총 개월수) X 경과 개월수',
      '4. 블로그, SNS 포스팅 등 바이럴 및 소셜마케팅 서비스에 관한 비용 공제는 다음 각호에 의한다.<개정 2016.9.18.>',
      '가. 패키지 상품의 경우, 서비스 완료 단계 이전에는 공제하지 않으나, 서비스 완료 단계 이후에는 다음의 대금 전액을 공제한다.',
      '① SNS포스팅 : 330,000원 (1set 기준, 특수한 경우 계약서 내 별도 명시비용 적용)',
      '② 블로그 포스팅 : 110,000원 (1회 기준, 특수한 경우 계약서 내 별도 명시비용 적용)',
      '(블로그 1회 포스팅 해당, 월보장형은 별도 외주비용 적용)',
      '③ 블로그 상위노출 : 330,000원 (1회 기준, 특수한 경우 계약서 내 별도 명시비용 적용) <신설 2016.9.18.>',
      '④ 연관검색어 : 330,000원 (1회 기준, 특수한 경우 계약서 내 별도 명시비용 적용) <신설 2016.9.18.>',
      '⑤ 블로그디자인 : 330,000원 (특수한 경우 계약서 내 별도 명시비용 적용) <신설 2017.12.13.>',
      '나. 패키지 내 포함 상품이 아닌 단품인 경우 결제금액에서 총 포스팅횟수(진행횟수)를 나누어 1회당 금액을 산정 후 실제 진행된 포스팅횟수에 비례한 금액을 공제한다.',
      '공제금액 산정식 : (계약금액 / 총 포스팅 횟수) X 완료 포스팅 횟수',
      '다. 기간으로 서비스가 제공되는 월 보장형과 같은 상품은 해지요청 해당 월 포함 결제금액에서 계약 개월수로 나누어 1개월당 금액을 산정 후 경과 개월수에 해당하는 금액을 공제한다.',
      '공제금액 산정식 : (계약금액 / 총 개월수) X 경과 개월수',
      '5. 자동결제 방식 서비스의 경우 이미 납부한 대금은 환불하지 않으며, CPC 형태의 광고의 경우에는 이미 집행한 비용을 제외한 금액을 환불한다.',
      '6. “을”의 귀책사유로 계약이 해지된 경우(제4조 4항 및 5항의 경우는 이에 해당하지 않음)에는 본조 1항 및 2항에 정한 결제대금의 20%는 공제할 수 없으며, 결제대금에서 계약 해지 시까지 집행된 비용 및 컨텐츠 비용 등을 제외한 전액을 환불한다.',
    ],
  },
  {
    title: '제 7 조 【기타】',
    body: [
      '"갑"은 "을"의 승인 없이 본 계약 및 약관에 명시되지 않은 특약 사항에 대하여 이를 "을"에게 주장할 수 없으며 "을"은 이로 인한 일체의 법률상 책임을 지지 않는다.',
    ],
  },
  {
    title: '제 8 조 【관할】',
    body: [
      '본 계약에 관하여 분쟁이 발생할 경우, 서울서부지방법원을 그 전속관할로 한다.',
    ],
  },
  {
    title: '□ 부칙',
    body: [],
  },
  {
    title: '제 1 조 【시행일】',
    body: [
      '본 약관은 2019년 3월 13일부터 시행한다. 다만, 제4조제10항부터 제11항 및 제6조제4항은 개정된 날부터 시행한다.',
    ],
  },
  {
    title: '제 2 조 【기존 계약고객에 대한 특례적용】',
    body: [
      '본 약관은 2019년 3월 13일 이전에 계약(성립)한 고객에게는 적용하지 아니하며, 본 약관 이전의 (구)약관에 적용을 받는다.',
    ],
  },
  {
    title: '제 3 조 【기존 계약고객에 대한 적용례】',
    body: [
      '단, 부칙 제 2조에 따른 기존 계약고객에 대한 특례적용은 2019년 3월 13일 이전 계약의 결제수단, 계약기간, 상품구성의 변경 및 잔금결제를 말한다.',
    ],
  },
];

function formatMoney(value) {
  const number = Number(value || 0);
  return number ? `${number.toLocaleString('ko-KR')}원` : '-';
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ko-KR', { hour12: false });
}

function AgreementLayout({ children }) {
  return (
    <main className="agreement_page">
      <section className="agreement_shell">
        <div className="agreement_logo">
          <img src="/img/logo/logo_w.svg" alt="I&VIEW Communication" />
        </div>
        {children}
      </section>
    </main>
  );
}

function AgreementState({ message, error }) {
  return (
    <AgreementLayout>
      <div className="agreement_state">
        {!error && <Spinner animation="border" size="sm" />}
        <p>{message}</p>
      </div>
    </AgreementLayout>
  );
}

function ContractField({ label, value, wide = false }) {
  return (
    <div className={`agreement_contract_field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function renderTermText(text, companyName) {
  if (!text.includes('{{companyName}}')) return text;

  const displayName = companyName || '고객';
  const [prefix, suffix] = text.split('{{companyName}}');

  return (
    <>
      {prefix}
      <strong className="agreement_term_company">{displayName}</strong>
      {suffix}
    </>
  );
}

function TermsContent({ companyName }) {
  return (
    <div className="agreement_terms_box">
      {termsSections.map(section => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.body.map(item => <p key={item}>{renderTermText(item, companyName)}</p>)}
        </section>
      ))}
    </div>
  );
}

function ContractContent({ contract }) {
  const productItems = contract?.productItems?.length
    ? contract.productItems
    : [contract?.productName].filter(Boolean);

  return (
    <section className="agreement_contract_card">
      <div className="agreement_contract_grid">
        <ContractField label="상호명" value={contract.companyName} />
        <ContractField label="대표자명" value={contract.ceoName} />
        <ContractField label="사업자등록번호" value={contract.businessRegNumber} />
        <ContractField label="연락처" value={contract.mobile || contract.tel} />
        <ContractField label="주소" value={contract.address} wide />
        <ContractField label="상품명" value={contract.productName} wide />
        <ContractField label="결제수단" value={contract.paymentMethod === '카드' ? contract.cardCompany : contract.paymentMethod} />
        <ContractField label="결제금액" value={formatMoney(contract.approvedAmount)} />
        <ContractField label="VAT" value={formatMoney(contract.vat)} />
        <ContractField label="계약기간" value={`${contract.contractStartDate || '-'} ~ ${contract.contractEndDate || '-'}`} />
        <ContractField label="담당자" value={contract.manager} />
        <ContractField label="담당자 연락처" value={contract.managerPhone} />
        <ContractField label="담당자 이메일" value={contract.managerEmail} wide />
      </div>

      <div className="agreement_products">
        <h2>상품정보등록</h2>
        {productItems.length ? (
          productItems.map(item => <p key={item}>{item}</p>)
        ) : (
          <p>등록된 상품 구성이 없습니다.</p>
        )}
      </div>

      <div className="agreement_notice">
        <p>본 계약서는 고객의 휴대폰으로 발송된 고유 링크를 통해 동의 처리됩니다.</p>
        <p>동의 일시와 접속 IP는 계약 확인 목적으로 저장될 수 있습니다.</p>
      </div>
    </section>
  );
}

function useAgreement(token) {
  const [agreement, setAgreement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/agreements/${token}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '계약서를 조회하지 못했습니다.');
      }

      setAgreement(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { agreement, isLoading, error, reload };
}

function mapAdToContract(ad) {
  const productItems = Array.isArray(ad.productItems)
    ? ad.productItems.map(item => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    id: ad.id,
    companyName: ad.companyName || '',
    ceoName: ad.ceoName || '',
    businessRegNumber: ad.businessRegNumber || '',
    tel: ad.tel || '',
    mobile: ad.mobile || '',
    address: [ad.postcode && `(${ad.postcode})`, ad.address, ad.detailAddress].filter(Boolean).join(' '),
    companyUrl: ad.companyUrl || '',
    companyEmail: ad.companyEmail || '',
    productName: ad.productName || '',
    approvedAmount: ad.approvedAmount,
    vat: ad.vat,
    paymentMethod: ad.paymentMethod || '',
    cardCompany: ad.cardCompany || '',
    installmentMonths: ad.installmentMonths || '',
    contractStartDate: ad.contractStartDate || '',
    contractEndDate: ad.contractEndDate || '',
    manager: ad.manager || '',
    managerPhone: '',
    managerEmail: '',
    productItems: productItems.length
      ? productItems
      : [ad.productName, ad.titleText, ad.descriptionText, ad.memo].filter(Boolean),
    smsContractStatus: ad.smsContractStatus,
    agreementStatus: ad.agreementStatus,
    agreementAt: ad.agreementAt,
  };
}

function useAgreementPreview(id) {
  const [contract, setContract] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadPreview = async () => {
      setIsLoading(true);
      setError('');

      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`/api/ads/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '계약서 미리보기를 불러오지 못했습니다.');
        }

        setContract(mapAdToContract(data.ad));
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [id]);

  return { contract, isLoading, error };
}

function AgreementTermsPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { agreement, isLoading, error } = useAgreement(token);

  if (isLoading) return <AgreementState message="이용약관을 불러오는 중입니다." />;
  if (error) return <AgreementState message={error} error />;

  return (
    <AgreementLayout>
      <div className="agreement_header">
        <p>SMS 계약서 동의</p>
        <h1>이용약관</h1>
        <span>{agreement.contract.companyName || '고객'}님 계약 동의 전 약관을 확인해주세요.</span>
      </div>

      {agreement.isAgreed && (
        <Alert variant="success" className="agreement_alert">
          이미 {formatDateTime(agreement.agreedAt || agreement.contract.agreementAt)}에 동의 완료된 계약서입니다.
        </Alert>
      )}

      <TermsContent companyName={agreement.contract.companyName} />

      <div className="agreement_actions">
        <button type="button" onClick={() => navigate(`/agreement/${token}/contract`)}>
          계약서 확인
        </button>
      </div>
    </AgreementLayout>
  );
}

function AgreementContractPage() {
  const { token } = useParams();
  const { agreement, isLoading, error } = useAgreement(token);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  const contract = agreement?.contract;

  const handleAgree = async () => {
    if (!window.confirm('계약서 내용을 확인했으며 동의하시겠습니까?')) return;

    setIsSubmitting(true);
    setSubmitMessage('');
    setSubmitError('');

    try {
      const res = await fetch(`/api/agreements/${token}/agree`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '동의 처리에 실패했습니다.');
      }

      setSubmitMessage(data.message);
      window.setTimeout(() => {
        window.location.href = data.redirectUrl || 'https://www.inviewcc.com';
      }, 600);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <AgreementState message="계약서를 불러오는 중입니다." />;
  if (error) return <AgreementState message={error} error />;

  return (
    <AgreementLayout>
      <div className="agreement_header">
        <p>온라인 마케팅 서비스</p>
        <h1>계약서</h1>
        <span>계약 내용을 확인한 뒤 하단의 동의 버튼을 눌러주세요.</span>
      </div>

      {(submitMessage || agreement.isAgreed) && (
        <Alert variant="success" className="agreement_alert">
          {submitMessage || `이미 ${formatDateTime(agreement.agreedAt || contract.agreementAt)}에 동의 완료된 계약서입니다.`}
        </Alert>
      )}
      {submitError && <Alert variant="danger" className="agreement_alert">{submitError}</Alert>}

      <ContractContent contract={contract} />

      <div className="agreement_actions split">
        <Link to={`/agreement/${token}`}>약관 다시 보기</Link>
        <button type="button" onClick={handleAgree} disabled={isSubmitting || agreement.isAgreed}>
          {agreement.isAgreed ? '동의 완료' : isSubmitting ? '처리 중...' : '동의'}
        </button>
      </div>
    </AgreementLayout>
  );
}

function AgreementPreviewTermsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { contract, isLoading, error } = useAgreementPreview(id);

  if (isLoading) return <AgreementState message="이용약관 미리보기를 불러오는 중입니다." />;
  if (error) return <AgreementState message={error} error />;

  return (
    <AgreementLayout>
      <div className="agreement_header">
        <p>관리자 미리보기</p>
        <h1>이용약관</h1>
        <span>{contract.companyName || '고객'} 계약서에 연결된 이용약관입니다.</span>
      </div>

      <TermsContent companyName={contract.companyName} />

      <div className="agreement_actions">
        <button type="button" onClick={() => navigate(`/contracts/ad-management/${id}/agreement-preview/contract`)}>
          계약서 확인
        </button>
      </div>
    </AgreementLayout>
  );
}

function AgreementPreviewContractPage() {
  const { id } = useParams();
  const { contract, isLoading, error } = useAgreementPreview(id);

  if (isLoading) return <AgreementState message="계약서 미리보기를 불러오는 중입니다." />;
  if (error) return <AgreementState message={error} error />;

  return (
    <AgreementLayout>
      <div className="agreement_header">
        <p>관리자 미리보기</p>
        <h1>서비스 이용계약서</h1>
        <span>SMS 발송 여부와 무관하게 확인하는 계약서 미리보기입니다.</span>
      </div>

      <ContractContent contract={contract} />

      <div className="agreement_actions split">
        <Link to={`/contracts/ad-management/${id}/agreement-preview`}>약관 다시 보기</Link>
        <button type="button" onClick={() => window.close()}>
          닫기
        </button>
      </div>
    </AgreementLayout>
  );
}

export {
  AgreementTermsPage,
  AgreementContractPage,
  AgreementPreviewTermsPage,
  AgreementPreviewContractPage,
};
