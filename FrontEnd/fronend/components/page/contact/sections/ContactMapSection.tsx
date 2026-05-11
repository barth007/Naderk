export function ContactMapSection() {
  return (
    <section className="bg-background pb-24 md:pb-32">
      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        <div className="relative w-full h-[400px] md:h-[500px] rounded-[2rem] overflow-hidden shadow-sm border border-border">
          {/* Replace src with your actual Google Maps embed URL */}
          <iframe 
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d126090.3551522867!2d7.387948332924151!3d9.083163799653842!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x104e745f4cd62fd9%3A0x53bd17b4a20ea12b!2sAbuja%2C%20Federal%20Capital%20Territory!5e0!3m2!1sen!2sng!4v1700000000000!5m2!1sen!2sng" 
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            allowFullScreen={false} 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade"
            title="NaderkEye Location Map"
            className="absolute inset-0"
          ></iframe>
        </div>
      </div>
    </section>
  );
}
